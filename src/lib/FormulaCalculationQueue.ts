/**
 * 异步公式计算队列系统
 * 
 * 核心功能：
 * 1. 队列管理：支持高优先级（用户输入）和低优先级（批量计算）
 * 2. 批量处理：每帧处理多个任务，避免阻塞 UI
 * 3. 任务取消：支持取消待处理任务
 * 4. 进度追踪：实时追踪计算进度
 * 5. 错误处理：单个任务失败不影响整体
 */

export type CalculationPriority = 'high' | 'normal' | 'low'

export interface CalculationTask {
  id: string
  row: number
  col: number
  formula: string
  priority: CalculationPriority
  createdAt: number
  resolve: (result: any) => void
  reject: (error: Error) => void
}

export interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  totalTime: number
}

type CalculateFunction = (formula: string, row: number, col: number) => any

export class FormulaCalculationQueue {
  private highPriorityQueue: CalculationTask[] = []
  private normalPriorityQueue: CalculationTask[] = []
  private lowPriorityQueue: CalculationTask[] = []
  
  private isProcessing = false
  private batchSize = 10 // 每帧处理的任务数
  private frameTime = 16 // 目标帧时间 (约60fps)
  
  private stats: QueueStats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalTime: 0
  }
  
  private calculateFunc: CalculateFunction
  private onProgressCallback?: (stats: QueueStats) => void
  private taskMap = new Map<string, CalculationTask>()
  
  constructor(calculateFunc: CalculateFunction) {
    this.calculateFunc = calculateFunc
  }
  
  /**
   * 添加计算任务到队列
   */
  addTask(
    row: number,
    col: number,
    formula: string,
    priority: CalculationPriority = 'normal'
  ): Promise<any> {
    const taskId = `${row}_${col}`
    
    // 如果已存在相同位置的任务，先取消旧任务
    if (this.taskMap.has(taskId)) {
      this.cancelTask(taskId)
    }
    
    return new Promise((resolve, reject) => {
      const task: CalculationTask = {
        id: taskId,
        row,
        col,
        formula,
        priority,
        createdAt: Date.now(),
        resolve,
        reject
      }
      
      this.taskMap.set(taskId, task)
      
      // 根据优先级添加到对应队列
      switch (priority) {
        case 'high':
          this.highPriorityQueue.push(task)
          break
        case 'normal':
          this.normalPriorityQueue.push(task)
          break
        case 'low':
          this.lowPriorityQueue.push(task)
          break
      }
      
      this.stats.pending++
      this.notifyProgress()
      
      // 启动处理循环
      if (!this.isProcessing) {
        this.startProcessing()
      }
    })
  }
  
  /**
   * 批量添加任务
   */
  addBatchTasks(
    tasks: Array<{ row: number; col: number; formula: string }>,
    priority: CalculationPriority = 'low'
  ): Promise<any[]> {
    const promises = tasks.map(task => 
      this.addTask(task.row, task.col, task.formula, priority)
    )
    return Promise.all(promises)
  }
  
  /**
   * 取消指定任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.taskMap.get(taskId)
    if (!task) return false
    
    // 从队列中移除
    const removeFromQueue = (queue: CalculationTask[]) => {
      const index = queue.findIndex(t => t.id === taskId)
      if (index !== -1) {
        queue.splice(index, 1)
        return true
      }
      return false
    }
    
    const removed = removeFromQueue(this.highPriorityQueue) ||
                   removeFromQueue(this.normalPriorityQueue) ||
                   removeFromQueue(this.lowPriorityQueue)
    
    if (removed) {
      this.taskMap.delete(taskId)
      this.stats.pending--
      task.reject(new Error('Task cancelled'))
      this.notifyProgress()
    }
    
    return removed
  }
  
  /**
   * 取消所有待处理任务
   */
  cancelAllPending(): void {
    const cancelQueue = (queue: CalculationTask[]) => {
      queue.forEach(task => {
        task.reject(new Error('All tasks cancelled'))
        this.taskMap.delete(task.id)
      })
      queue.length = 0
    }
    
    cancelQueue(this.highPriorityQueue)
    cancelQueue(this.normalPriorityQueue)
    cancelQueue(this.lowPriorityQueue)
    
    this.stats.pending = 0
    this.notifyProgress()
  }
  
  /**
   * 设置进度回调
   */
  onProgress(callback: (stats: QueueStats) => void): void {
    this.onProgressCallback = callback
  }
  
  /**
   * 获取队列统计信息
   */
  getStats(): QueueStats {
    return { ...this.stats }
  }
  
  /**
   * 设置批处理大小
   */
  setBatchSize(size: number): void {
    this.batchSize = Math.max(1, size)
  }
  
  /**
   * 检查是否有待处理任务
   */
  hasPendingTasks(): boolean {
    return this.highPriorityQueue.length > 0 ||
           this.normalPriorityQueue.length > 0 ||
           this.lowPriorityQueue.length > 0
  }
  
  /**
   * 启动处理循环
   */
  private startProcessing(): void {
    if (this.isProcessing) return
    this.isProcessing = true
    this.processNextBatch()
  }
  
  /**
   * 处理下一批任务
   */
  private async processNextBatch(): Promise<void> {
    if (!this.hasPendingTasks()) {
      this.isProcessing = false
      return
    }
    
    const startTime = performance.now()
    const batch: CalculationTask[] = []
    
    // 按优先级取任务：高 > 普通 > 低
    while (batch.length < this.batchSize && this.hasPendingTasks()) {
      let task: CalculationTask | undefined
      
      if (this.highPriorityQueue.length > 0) {
        task = this.highPriorityQueue.shift()
      } else if (this.normalPriorityQueue.length > 0) {
        task = this.normalPriorityQueue.shift()
      } else if (this.lowPriorityQueue.length > 0) {
        task = this.lowPriorityQueue.shift()
      }
      
      if (task) {
        batch.push(task)
      }
    }
    
    // 处理这批任务
    await this.processBatch(batch)
    
    const elapsedTime = performance.now() - startTime
    
    // 如果处理时间小于一帧时间，立即处理下一批
    // 否则等待下一帧，避免阻塞 UI
    if (elapsedTime < this.frameTime && this.hasPendingTasks()) {
      this.processNextBatch()
    } else if (this.hasPendingTasks()) {
      requestAnimationFrame(() => this.processNextBatch())
    } else {
      this.isProcessing = false
    }
  }
  
  /**
   * 处理一批任务
   */
  private async processBatch(batch: CalculationTask[]): Promise<void> {
    for (const task of batch) {
      this.stats.pending--
      this.stats.processing++
      this.notifyProgress()
      
      const startTime = performance.now()
      
      try {
        // 执行计算
        const result = this.calculateFunc(task.formula, task.row, task.col)
        
        // 标记完成
        this.stats.processing--
        this.stats.completed++
        this.stats.totalTime += performance.now() - startTime
        
        this.taskMap.delete(task.id)
        task.resolve(result)
      } catch (error) {
        // 标记失败
        this.stats.processing--
        this.stats.failed++
        
        this.taskMap.delete(task.id)
        task.reject(error as Error)
        
        console.error(`[Queue] 计算失败 ${task.id}:`, error)
      }
      
      this.notifyProgress()
    }
  }
  
  /**
   * 通知进度更新
   */
  private notifyProgress(): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(this.getStats())
    }
  }
  
  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalTime: 0
    }
    this.notifyProgress()
  }
}
