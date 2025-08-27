import Foundation
import PencilKit
import React

@objc(RNPKCanvasView)
class RNPKCanvasView: UIView, PKCanvasViewDelegate {

  let canvas = PKCanvasView()

  // RN props/events
  @objc var onBegin: RCTBubblingEventBlock?
  @objc var onChange: RCTBubblingEventBlock?
  @objc var onEnd: RCTBubblingEventBlock?

  @objc var fingerEnabled: NSNumber = 1 { didSet { canvas.allowsFingerDrawing = fingerEnabled.boolValue } }
  @objc var tool: NSString = "pencil" { didSet { applyTool() } }
  @objc var color: NSString = "#2B2B2B" { didSet { applyTool() } }
  @objc var lineWidth: NSNumber = 4 { didSet { applyTool() } }

  override init(frame: CGRect) {
    super.init(frame: frame)
    setup()
  }
  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setup()
  }

  private func setup() {
    canvas.delegate = self
    canvas.drawingPolicy = .anyInput        // or .pencilOnly
    canvas.allowsFingerDrawing = true
    canvas.backgroundColor = .clear
    
    // Ensure undo manager is properly configured
    if canvas.undoManager == nil {
      canvas.undoManager = UndoManager()
    }
    
    addSubview(canvas)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    canvas.frame = bounds
  }

  private func applyTool() {
    let uiColor = UIColor(hex: color as String) ?? .black
    let w = CGFloat(truncating: lineWidth)
    switch tool as String {
      case "pen":    canvas.tool = PKInkingTool(.pen,    color: uiColor, width: w)
      case "marker": canvas.tool = PKInkingTool(.marker, color: uiColor, width: w)
      case "pencil": canvas.tool = PKInkingTool(.pencil, color: uiColor, width: w)
      case "eraserVector": 
        // Use smaller eraser width
        let eraserWidth = min(w * 0.6, 20) // 60% of brush width, max 20pt
        canvas.tool = PKEraserTool(.vector, width: eraserWidth)
      case "eraserBitmap": 
        let eraserWidth = min(w * 0.6, 20)
        canvas.tool = PKEraserTool(.bitmap, width: eraserWidth)
      default: canvas.tool = PKInkingTool(.pencil, color: uiColor, width: w)
    }
  }

  // Delegate
  func canvasViewDrawingDidBegin(_ canvasView: PKCanvasView) { onBegin?([:]) }
  func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) { onChange?([:]) }
  func canvasViewDrawingDidEnd(_ canvasView: PKCanvasView)   { onEnd?([:]) }

  // Commands called from the manager
  func clear() { canvas.drawing = PKDrawing() }

  func undo() {
    if canvas.undoManager?.canUndo == true {
      canvas.undoManager?.undo()
    }
  }
  func redo() {
    if canvas.undoManager?.canRedo == true {
      canvas.undoManager?.redo()
    }
  }

  func setPolicy(_ policy: String) {
    canvas.drawingPolicy = (policy == "pencilOnly") ? .pencilOnly : .anyInput
  }

  func exportBase64() -> String? {
    let img = canvas.drawing.image(from: canvas.bounds, scale: UIScreen.main.scale)
    return img.pngData()?.base64EncodedString()
  }
}

private extension UIColor {
  convenience init?(hex: String) {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    var v: UInt64 = 0
    guard Scanner(string: s).scanHexInt64(&v) else { return nil }
    let r,g,b,a: CGFloat
    switch s.count {
      case 8:
        a = CGFloat((v & 0xff000000) >> 24) / 255.0
        r = CGFloat((v & 0x00ff0000) >> 16) / 255.0
        g = CGFloat((v & 0x0000ff00) >> 8)  / 255.0
        b = CGFloat( v & 0x000000ff)        / 255.0
      case 6:
        a = 1.0
        r = CGFloat((v & 0xff0000) >> 16) / 255.0
        g = CGFloat((v & 0x00ff00) >> 8)  / 255.0
        b = CGFloat( v & 0x0000ff)        / 255.0
      default: return nil
    }
    self.init(red: r, green: g, blue: b, alpha: a)
  }
}