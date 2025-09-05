import Foundation
import PencilKit
import React

@objc(RNPKCanvasView)
class RNPKCanvasView: UIView, PKCanvasViewDelegate {

    let canvas = PKCanvasView()
    private var toolPicker: PKToolPicker?

    override var canBecomeFirstResponder: Bool { true }

    // RN props/events
    @objc var onBegin: RCTBubblingEventBlock?
    @objc var onChange: RCTBubblingEventBlock?
    @objc var onEnd: RCTBubblingEventBlock?

    @objc var fingerEnabled: NSNumber = 1 {
        didSet {
            if #available(iOS 14.0, *) {
                canvas.drawingPolicy = fingerEnabled.boolValue ? .anyInput : .pencilOnly
            } else {
                canvas.allowsFingerDrawing = fingerEnabled.boolValue
            }
        }
    }

    @objc var tool: NSString = "pencil" { didSet { applyTool() } }
    @objc var color: NSString = "#4A4A4A" { didSet { applyTool() } }
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
        canvas.drawingPolicy = .anyInput
        canvas.backgroundColor = .clear
        addSubview(canvas)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        canvas.frame = bounds
        ensureToolPickerVisible()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        ensureToolPickerVisible()
    }

    override func didMoveToSuperview() {
        super.didMoveToSuperview()
        ensureToolPickerVisible()
    }

    private func ensureToolPickerVisible() {
        guard let win = self.window else { return }
        if let picker = PKToolPicker.shared(for: win) {
            toolPicker = picker
            picker.setVisible(true, forFirstResponder: canvas)
            picker.addObserver(canvas)
            DispatchQueue.main.async { [weak self] in
                self?.canvas.becomeFirstResponder()
            }
        }
    }


    deinit {
        toolPicker?.removeObserver(canvas)
    }

    private func applyTool() {
        let base = UIColor(hex: color as String) ?? .black
        let w = CGFloat(truncating: lineWidth)
        let opaque = base.withAlphaComponent(1)

        switch tool as String {
        case "pen":
            canvas.tool = PKInkingTool(.pen, color: base, width: w)
        case "marker":
            canvas.tool = PKInkingTool(.marker, color: base, width: w)
        case "pencil":
            canvas.tool = PKInkingTool(.pencil, color: base, width: w)
        case "fountainPen":
            if #available(iOS 17.0, *) {
                canvas.tool = PKInkingTool(.fountainPen, color: opaque, width: w)
            } else {
                canvas.tool = PKInkingTool(.pen, color: opaque, width: w)
            }
        case "eraserVector":
            let eraserWidth = min(w * 0.6, 20)
            if #available(iOS 16.4, *) {
                canvas.tool = PKEraserTool(.vector, width: eraserWidth)
            } else {
                canvas.tool = PKEraserTool(.vector)
            }
        case "eraserBitmap":
            let eraserWidth = min(w * 0.6, 20)
            if #available(iOS 16.4, *) {
                canvas.tool = PKEraserTool(.bitmap, width: eraserWidth)
            } else {
                canvas.tool = PKEraserTool(.bitmap)
            }
        default:
            canvas.tool = PKInkingTool(.pencil, color: base, width: w)
        }
    }

    // Delegate
    func canvasViewDrawingDidBegin(_ canvasView: PKCanvasView) { onBegin?([:]) }
    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) { onChange?([:]) }
    func canvasViewDrawingDidEnd(_ canvasView: PKCanvasView) { onEnd?([:]) }

    // Commands
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
        // Ensure layout is current
        setNeedsLayout()
        layoutIfNeeded()

        var rect = canvas.bounds.integral
        let drawingRect = canvas.drawing.bounds.integral
        if rect.width < 2 || rect.height < 2 {
            if drawingRect.isEmpty {
                print("⚠️ exportBase64: zero bounds and empty drawing")
                rect = CGRect(x: 0, y: 0, width: 2, height: 2)
            } else {
                rect = drawingRect.insetBy(dx: -2, dy: -2).integral
            }
        }

        let scale = max(1, UIScreen.main.scale)
        print("📐 exportBase64 rect:", rect, "scale:", scale, "strokes:", canvas.drawing.strokes.count)

        // Primary: PencilKit rasterizer
        let img = canvas.drawing.image(from: rect, scale: scale)
        if let data = img.pngData(), data.count > 0 {
            return data.base64EncodedString()
        }

        print("ℹ️ exportBase64: PK rasterizer empty, consider snapshot fallback")
        return nil
    }

    func exportBase64Snapshot() -> String? {
        setNeedsLayout()
        layoutIfNeeded()

        var rect = canvas.bounds.integral
        if rect.width < 2 || rect.height < 2 {
            let drawingRect = canvas.drawing.bounds.integral
            rect = drawingRect.isEmpty ? CGRect(x: 0, y: 0, width: 2, height: 2)
                                    : drawingRect.insetBy(dx: -2, dy: -2).integral
        }

        let format = UIGraphicsImageRendererFormat()
        format.scale = max(1, UIScreen.main.scale)
        format.opaque = true  // white background looks better in Photos

        let renderer = UIGraphicsImageRenderer(size: rect.size, format: format)
        let image = renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: rect.size))
            ctx.cgContext.translateBy(x: -rect.origin.x, y: -rect.origin.y)
            canvas.layer.render(in: ctx.cgContext)
        }

        guard let data = image.pngData(), data.count > 0 else {
            print("❌ exportBase64Snapshot: layer render produced no data")
            return nil
        }
        print("✅ exportBase64Snapshot: size \(image.size)")
        return data.base64EncodedString()
    }

    func exportBase64OnWhite() -> String? {
        setNeedsLayout()
        layoutIfNeeded()

        var rect = canvas.bounds.integral
        if rect.width < 1 || rect.height < 1 {
            let drawingRect = canvas.drawing.bounds
            rect = drawingRect.isEmpty ? CGRect(x: 0, y: 0, width: 2, height: 2) : drawingRect.insetBy(dx: -2, dy: -2).integral
        }

        let format = UIGraphicsImageRendererFormat()
        format.scale = max(1, UIScreen.main.scale)
        format.opaque = true

        let renderer = UIGraphicsImageRenderer(size: rect.size, format: format)
        let img = renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: rect.size))
            // draw the PKDrawing into our white canvas
            imgFromDrawing(rect: rect, scale: format.scale).draw(at: .zero)
        }
        guard let data = img.pngData() else { return nil }
        return data.base64EncodedString()
    }

    private func imgFromDrawing(rect: CGRect, scale: CGFloat) -> UIImage {
        canvas.drawing.image(from: rect, scale: scale)
    }
}

private extension UIColor {
    convenience init?(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        guard Scanner(string: s).scanHexInt64(&v) else { return nil }
        let r, g, b, a: CGFloat
        switch s.count {
        case 8:
            a = CGFloat((v & 0xff000000) >> 24) / 255.0
            r = CGFloat((v & 0x00ff0000) >> 16) / 255.0
            g = CGFloat((v & 0x0000ff00) >> 8) / 255.0
            b = CGFloat(v & 0x000000ff) / 255.0
        case 6:
            a = 1.0
            r = CGFloat((v & 0xff0000) >> 16) / 255.0
            g = CGFloat((v & 0x00ff00) >> 8) / 255.0
            b = CGFloat(v & 0x0000ff) / 255.0
        default:
            return nil
        }
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}
