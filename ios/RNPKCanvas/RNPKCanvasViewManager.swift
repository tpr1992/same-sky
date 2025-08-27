import Foundation
import React

@objc(RNPKCanvasViewManager)
class RNPKCanvasViewManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool { true }
  override func view() -> UIView! { RNPKCanvasView() }

  // Commands exposed to JS (each receives reactTag)
  @objc func clear(_ reactTag: NSNumber) {
    bridge.uiManager.addUIBlock { _, views in (views?[reactTag] as? RNPKCanvasView)?.clear() }
  }

  @objc func undo(_ reactTag: NSNumber) {
    bridge.uiManager.addUIBlock { _, views in (views?[reactTag] as? RNPKCanvasView)?.undo() }
  }

  @objc func redo(_ reactTag: NSNumber) {
    bridge.uiManager.addUIBlock { _, views in (views?[reactTag] as? RNPKCanvasView)?.redo() }
  }

  @objc func setDrawingPolicy(_ reactTag: NSNumber, policy: NSString) {
    bridge.uiManager.addUIBlock { _, views in (views?[reactTag] as? RNPKCanvasView)?.setPolicy(policy as String) }
  }

  @objc func exportBase64(_ reactTag: NSNumber,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    bridge.uiManager.addUIBlock { _, views in
      if let b64 = (views?[reactTag] as? RNPKCanvasView)?.exportBase64() {
        resolve(b64)
      } else {
        reject("E_EXPORT", "Failed to export image", nil)
      }
    }
  }
}