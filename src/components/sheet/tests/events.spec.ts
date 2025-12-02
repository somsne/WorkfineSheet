import { describe, it, expect, vi } from 'vitest'
import { EventManager } from '../events'
import type { EventHandlers } from '../events'

describe('EventManager', () => {
  it('should register event listeners', () => {
    const manager = new EventManager()
    const element = document.createElement('div')
    const handlers: EventHandlers = {
      onMouseDown: vi.fn(),
      onMouseMove: vi.fn(),
      onMouseUp: vi.fn(),
      onWheel: vi.fn(),
      onClick: vi.fn(),
      onDoubleClick: vi.fn(),
      onKeyDown: vi.fn(),
      onPaste: vi.fn(),
      onCopy: vi.fn(),
      onCut: vi.fn(),
      onResize: vi.fn(),
      onCompositionStart: vi.fn(),
      onGlobalMouseMove: vi.fn(),
      onGlobalMouseUp: vi.fn(),
    }

    expect(manager.isRegistered()).toBe(false)
    manager.register(element, handlers)
    expect(manager.isRegistered()).toBe(true)
  })

  it('should unregister event listeners', () => {
    const manager = new EventManager()
    const element = document.createElement('div')
    const handlers: EventHandlers = {
      onMouseDown: vi.fn(),
      onMouseMove: vi.fn(),
      onMouseUp: vi.fn(),
      onWheel: vi.fn(),
      onClick: vi.fn(),
      onDoubleClick: vi.fn(),
      onKeyDown: vi.fn(),
      onPaste: vi.fn(),
      onCopy: vi.fn(),
      onCut: vi.fn(),
      onResize: vi.fn(),
      onCompositionStart: vi.fn(),
      onGlobalMouseMove: vi.fn(),
      onGlobalMouseUp: vi.fn(),
    }

    manager.register(element, handlers)
    expect(manager.isRegistered()).toBe(true)
    
    manager.unregister()
    expect(manager.isRegistered()).toBe(false)
  })

  it('should trigger registered handlers', () => {
    const manager = new EventManager()
    const element = document.createElement('div')
    const mousedownHandler = vi.fn()
    const handlers: EventHandlers = {
      onMouseDown: mousedownHandler,
      onMouseMove: vi.fn(),
      onMouseUp: vi.fn(),
      onWheel: vi.fn(),
      onClick: vi.fn(),
      onDoubleClick: vi.fn(),
      onKeyDown: vi.fn(),
      onPaste: vi.fn(),
      onCopy: vi.fn(),
      onCut: vi.fn(),
      onResize: vi.fn(),
      onCompositionStart: vi.fn(),
      onGlobalMouseMove: vi.fn(),
      onGlobalMouseUp: vi.fn(),
    }

    manager.register(element, handlers)

    const event = new MouseEvent('mousedown')
    element.dispatchEvent(event)

    expect(mousedownHandler).toHaveBeenCalledWith(event)
  })

  it('should not throw when unregister without register', () => {
    const manager = new EventManager()
    expect(() => manager.unregister()).not.toThrow()
  })

  it('should handle multiple register calls safely', () => {
    const manager = new EventManager()
    const element = document.createElement('div')
    const handlers: EventHandlers = {
      onMouseDown: vi.fn(),
      onMouseMove: vi.fn(),
      onMouseUp: vi.fn(),
      onWheel: vi.fn(),
      onClick: vi.fn(),
      onDoubleClick: vi.fn(),
      onKeyDown: vi.fn(),
      onPaste: vi.fn(),
      onCopy: vi.fn(),
      onCut: vi.fn(),
      onResize: vi.fn(),
      onCompositionStart: vi.fn(),
      onGlobalMouseMove: vi.fn(),
      onGlobalMouseUp: vi.fn(),
    }

    manager.register(element, handlers)
    manager.register(element, handlers) // Should not cause issues

    expect(manager.isRegistered()).toBe(true)
  })
})
