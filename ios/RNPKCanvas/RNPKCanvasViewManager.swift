import Foundation
import UIKit
import React

@objc(RNPKCanvasViewManager)
class RNPKCanvasViewManager: RCTViewManager {
    override static func requiresMainQueueSetup() -> Bool { true }

    override func view() -> UIView! {
        return RNPKCanvasView()
    }

    // MARK: - Helpers

    private func resolvePKView(reactTag: NSNumber,
                               uiManager: RCTUIManager?,
                               viewRegistry: [NSNumber: UIView]?) -> RNPKCanvasView? {
        // 1) registry direct hit
        if let v = viewRegistry?[reactTag] {
            if let pk = v as? RNPKCanvasView { return pk }
            if let pk = findPKInSubviews(of: v) { return pk }
        }

        // 2) uiManager fallback
        if let ui = uiManager, let v = ui.view(forReactTag: reactTag) {
            if let pk = v as? RNPKCanvasView { return pk }
            if let pk = findPKInSubviews(of: v) { return pk }
        }

        return nil
    }

    private func findPKInSubviews(of root: UIView) -> RNPKCanvasView? {
        if let pk = root as? RNPKCanvasView { return pk }
        for sub in root.subviews {
            if let pk = findPKInSubviews(of: sub) { return pk }
        }
        return nil
    }

    // MARK: - Commands

    @objc func clear(_ reactTag: NSNumber) {
        bridge.uiManager.addUIBlock { ui, views in
            self.resolvePKView(reactTag: reactTag, uiManager: ui, viewRegistry: views)?
                .clear()
        }
    }

    @objc func undo(_ reactTag: NSNumber) {
        bridge.uiManager.addUIBlock { ui, views in
            self.resolvePKView(reactTag: reactTag, uiManager: ui, viewRegistry: views)?
                .undo()
        }
    }

    @objc func redo(_ reactTag: NSNumber) {
        bridge.uiManager.addUIBlock { ui, views in
            self.resolvePKView(reactTag: reactTag, uiManager: ui, viewRegistry: views)?
                .redo()
        }
    }

    @objc func setDrawingPolicy(_ reactTag: NSNumber, policy: NSString) {
        bridge.uiManager.addUIBlock { ui, views in
            self.resolvePKView(reactTag: reactTag, uiManager: ui, viewRegistry: views)?
                .setPolicy(policy as String)
        }
    }

    @objc func exportBase64(_ reactTag: NSNumber,
                            resolver resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
        bridge.uiManager.addUIBlock { ui, views in
            guard let pk = self.resolvePKView(reactTag: reactTag, uiManager: ui, viewRegistry: views) else {
                print("❌ RNPKCanvasViewManager.exportBase64: view not found for tag \(reactTag)")
                reject("E_EXPORT", "View not found", nil)
                return
            }

            if let b64 = pk.exportBase64(), !b64.isEmpty {
                print("✅ RNPKCanvasViewManager.exportBase64: base64 length \(b64.count)")
                resolve(b64)
                return
            }

            print("⚠️ RNPKCanvasViewManager.exportBase64: primary nil/empty, trying snapshot")
            if let snap = pk.exportBase64Snapshot(), !snap.isEmpty {
                print("✅ RNPKCanvasViewManager.exportBase64: snapshot length \(snap.count)")
                resolve(snap)
            } else {
                print("❌ RNPKCanvasViewManager.exportBase64: both primary and snapshot failed")
                reject("E_EXPORT", "Failed to export image", nil)
            }
        }
    }

    @objc func exportBase64Snapshot(_ reactTag: NSNumber,
                                    resolver resolve: @escaping RCTPromiseResolveBlock,
                                    rejecter reject: @escaping RCTPromiseRejectBlock) {
        bridge.uiManager.addUIBlock { ui, views in
            guard let pk = self.resolvePKView(reactTag: reactTag, uiManager: ui, viewRegistry: views) else {
                reject("E_EXPORT", "View not found", nil)
                return
            }
            if let b64 = pk.exportBase64Snapshot(), !b64.isEmpty {
                resolve(b64)
            } else {
                reject("E_EXPORT", "Snapshot failed", nil)
            }
        }
    }
}
