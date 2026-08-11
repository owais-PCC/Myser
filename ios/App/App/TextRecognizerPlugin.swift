import Foundation
import Capacitor
import Vision
import UIKit

/// Native OCR for iOS using Apple's own on-device Vision framework
/// (VNRecognizeTextRequest, iOS 13+) — no network calls, no data leaves
/// the device, no third-party service involved. Mirrors
/// android/app/src/main/java/com/owais/myser/TextRecognizerPlugin.java's
/// interface exactly (same plugin name "TextRecognizer", same
/// recognize({base64}) -> {text} shape) so src/lib/ocr-pipeline.ts's
/// existing recognizeText() call works unmodified on iOS — no JS/TS
/// changes needed for this to take effect.
///
/// Before this file existed, iOS had no native OCR plugin at all
/// (confirmed by searching ios/App/App/ — nothing registered the
/// "TextRecognizer" plugin name), so ocr-pipeline.ts's try/catch
/// silently fell through to the much slower, less accurate Tesseract.js
/// browser-based fallback on every iOS device. This plugin closes that
/// gap, bringing iOS OCR quality in line with Android's (which already
/// uses Google ML Kit, also fully on-device).
///
/// Registered explicitly from MainViewController.swift via
/// bridge?.registerPluginType(...), mirroring Android's explicit
/// registerPlugin(TextRecognizerPlugin.class) call in MainActivity.java
/// — not relying on Capacitor's CocoaPods-based plugin auto-discovery,
/// which only applies to plugins shipped as separate pods, not classes
/// living directly in the app target like this one.
@objc(TextRecognizerPlugin)
public class TextRecognizerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TextRecognizerPlugin"
    public let jsName = "TextRecognizer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognize", returnType: CAPPluginReturnPromise)
    ]

    @objc func recognize(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"), !base64.isEmpty else {
            call.reject("No image data provided")
            return
        }
        guard let data = Data(base64Encoded: base64) else {
            call.reject("Could not decode image")
            return
        }
        guard let uiImage = UIImage(data: data), let cgImage = uiImage.cgImage else {
            call.reject("Could not decode image")
            return
        }

        let request = VNRecognizeTextRequest { request, error in
            if let error = error {
                call.reject("OCR failed: \(error.localizedDescription)")
                return
            }
            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                call.resolve(["text": ""])
                return
            }
            // Top candidate per observed text line, joined the same way
            // Android's ML Kit Text.getText() concatenates recognized
            // lines, so downstream regex parsing in ocr-pipeline.ts sees
            // an equivalent shape from either platform.
            let text = observations
                .compactMap { $0.topCandidates(1).first?.string }
                .joined(separator: "\n")
            call.resolve(["text": text])
        }
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up)
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                call.reject("OCR failed: \(error.localizedDescription)")
            }
        }
    }
}
