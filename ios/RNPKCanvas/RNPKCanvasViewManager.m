#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(RNPKCanvasViewManager, RCTViewManager)
  RCT_EXPORT_VIEW_PROPERTY(tool, NSString)
  RCT_EXPORT_VIEW_PROPERTY(color, NSString)
  RCT_EXPORT_VIEW_PROPERTY(lineWidth, NSNumber)
  RCT_EXPORT_VIEW_PROPERTY(fingerEnabled, NSNumber)
  RCT_EXPORT_VIEW_PROPERTY(onBegin, RCTBubblingEventBlock)
  RCT_EXPORT_VIEW_PROPERTY(onChange, RCTBubblingEventBlock)
  RCT_EXPORT_VIEW_PROPERTY(onEnd, RCTBubblingEventBlock)

  RCT_EXTERN_METHOD(clear:(nonnull NSNumber *)reactTag)
  RCT_EXTERN_METHOD(undo:(nonnull NSNumber *)reactTag)
  RCT_EXTERN_METHOD(redo:(nonnull NSNumber *)reactTag)
  RCT_EXTERN_METHOD(setDrawingPolicy:(nonnull NSNumber *)reactTag policy:(NSString *)policy)
  RCT_EXTERN_METHOD(exportBase64:(nonnull NSNumber *)reactTag
                    resolver:(RCTPromiseResolveBlock)resolve
                    rejecter:(RCTPromiseRejectBlock)reject)
  RCT_EXTERN_METHOD(exportBase64Snapshot:(nonnull NSNumber *)reactTag
                    resolver:(RCTPromiseResolveBlock)resolve
                    rejecter:(RCTPromiseRejectBlock)reject)
@end
