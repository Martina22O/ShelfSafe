const { withGradleProperties, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withBarcodeScannerFix(config) {
  // 1. Ensure gradle.properties includes expo.camera.barcode-scanner-enabled=true
  config = withGradleProperties(config, (config) => {
    const exists = config.modResults.some(
      (item) => item.key === 'expo.camera.barcode-scanner-enabled'
    );
    if (!exists) {
      config.modResults.push({
        type: 'property',
        key: 'expo.camera.barcode-scanner-enabled',
        value: 'true',
      });
      console.log('[withBarcodeScannerFix] Set expo.camera.barcode-scanner-enabled=true in gradle.properties');
    }
    return config;
  });

  // 2. Patch expo-camera Android source during EAS / prebuild phase
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;

      // Robustly resolve expo-camera directory across monorepo and hoisted structures
      let expoCameraDir;
      try {
        const pkgJson = require.resolve('expo-camera/package.json', {
          paths: [
            projectRoot,
            path.resolve(projectRoot, '..'),
            path.resolve(projectRoot, '../..'),
          ],
        });
        expoCameraDir = path.dirname(pkgJson);
      } catch {
        const candidates = [
          path.resolve(projectRoot, 'node_modules/expo-camera'),
          path.resolve(projectRoot, '../node_modules/expo-camera'),
          path.resolve(projectRoot, '../../node_modules/expo-camera'),
        ];
        expoCameraDir = candidates.find((p) => fs.existsSync(p));
      }

      if (!expoCameraDir || !fs.existsSync(expoCameraDir)) {
        throw new Error(
          `[withBarcodeScannerFix] Could not locate expo-camera package directory relative to projectRoot: ${projectRoot}`
        );
      }

      // 1. Ensure ML Kit ProGuard / R8 reflection keep rules are applied
      // This prevents R8 from stripping ComponentRegistrar.<init>[] in release APK builds
      const mlkitProguardRules = `
# ML Kit Barcode Scanning reflection keep rules
-keep class com.google.mlkit.vision.barcode.** { *; }
-keep class com.google.mlkit.vision.common.** { *; }
-keep class com.google.mlkit.common.** { *; }

-keep class * implements com.google.firebase.components.ComponentRegistrar {
    public <init>();
}

-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-keep class com.google.android.gms.internal.mlkit_** { *; }
-keep class com.google.android.gms.vision.** { *; }
-keep class com.google.android.libraries.barhopper.** { *; }
`;

      const cameraAndroidDir = path.join(expoCameraDir, 'android');
      const consumerRulesPath = path.join(cameraAndroidDir, 'consumer-rules.pro');
      const cameraBuildGradlePath = path.join(cameraAndroidDir, 'build.gradle');

      if (!fs.existsSync(consumerRulesPath) || !fs.readFileSync(consumerRulesPath, 'utf8').includes('ComponentRegistrar')) {
        fs.writeFileSync(consumerRulesPath, mlkitProguardRules.trim() + '\n', 'utf8');
        console.log('[withBarcodeScannerFix] Created consumer-rules.pro for expo-camera');
      }

      if (fs.existsSync(cameraBuildGradlePath)) {
        let gradleContent = fs.readFileSync(cameraBuildGradlePath, 'utf8');
        if (!gradleContent.includes("consumerProguardFiles 'consumer-rules.pro'")) {
          gradleContent = gradleContent.replace(
            /defaultConfig\s*\{/,
            "defaultConfig {\n    consumerProguardFiles 'consumer-rules.pro'"
          );
          fs.writeFileSync(cameraBuildGradlePath, gradleContent, 'utf8');
          console.log('[withBarcodeScannerFix] Added consumerProguardFiles to expo-camera build.gradle');
        }
      }

      const appProguardPaths = [
        platformProjectRoot ? path.join(platformProjectRoot, 'app/proguard-rules.pro') : null,
        path.join(projectRoot, 'android/app/proguard-rules.pro'),
      ].filter(Boolean);

      for (const appProguardPath of appProguardPaths) {
        if (fs.existsSync(appProguardPath)) {
          let appProguardContent = fs.readFileSync(appProguardPath, 'utf8');
          if (!appProguardContent.includes('ComponentRegistrar')) {
            appProguardContent += '\n' + mlkitProguardRules.trim() + '\n';
            fs.writeFileSync(appProguardPath, appProguardContent, 'utf8');
            console.log(`[withBarcodeScannerFix] Appended ML Kit keep rules to ${appProguardPath}`);
          }
        }
      }

      const cameraViewPath = path.join(
        expoCameraDir,
        'android/src/main/java/expo/modules/camera/ExpoCameraView.kt'
      );
      const analyzerPath = path.join(
        expoCameraDir,
        'android/src/main/java/expo/modules/camera/analyzers/BarcodeAnalyzer.kt'
      );

      // Verify and patch ExpoCameraView.kt
      if (!fs.existsSync(cameraViewPath)) {
        throw new Error(
          `[withBarcodeScannerFix] Expected ExpoCameraView.kt not found at: ${cameraViewPath}`
        );
      }

      let cameraViewContent = fs.readFileSync(cameraViewPath, 'utf8');
      const unpatchedSettingsRegex = /fun setBarcodeScannerSettings\(settings: BarcodeSettings\?\) \{\s*barcodeFormats = settings\?\.barcodeTypes \?: emptyList\(\)\s*\}/;
      const patchedSettingsRegex = /fun setBarcodeScannerSettings\(settings: BarcodeSettings\?\) \{\s*barcodeFormats = settings\?\.barcodeTypes \?: emptyList\(\)\s*shouldCreateCamera = true\s*\}/;

      if (patchedSettingsRegex.test(cameraViewContent)) {
        console.log('[withBarcodeScannerFix] ExpoCameraView.kt already contains shouldCreateCamera in setBarcodeScannerSettings (idempotent pass)');
      } else if (unpatchedSettingsRegex.test(cameraViewContent)) {
        cameraViewContent = cameraViewContent.replace(
          unpatchedSettingsRegex,
          'fun setBarcodeScannerSettings(settings: BarcodeSettings?) {\n    barcodeFormats = settings?.barcodeTypes ?: emptyList()\n    shouldCreateCamera = true\n  }'
        );
        console.log('[withBarcodeScannerFix] Successfully patched ExpoCameraView.kt to recreate camera on barcode settings change');
      } else {
        throw new Error(
          '[withBarcodeScannerFix] setBarcodeScannerSettings signature not matched in ExpoCameraView.kt'
        );
      }

      // Optimize ImageAnalysis resolution to 720p for fast ML Kit processing
      if (cameraViewContent.includes('setResolutionStrategy(ResolutionStrategy.HIGHEST_AVAILABLE_STRATEGY)') && cameraViewContent.includes('createImageAnalyzer')) {
        cameraViewContent = cameraViewContent.replace(
          /private fun createImageAnalyzer\(\): ImageAnalysis =\s*ImageAnalysis\.Builder\(\)\s*\.setResolutionSelector\(\s*ResolutionSelector\.Builder\(\)\s*\.setResolutionStrategy\(ResolutionStrategy\.HIGHEST_AVAILABLE_STRATEGY\)\s*\.build\(\)\s*\)/,
          'private fun createImageAnalyzer(): ImageAnalysis =\n    ImageAnalysis.Builder()\n      .setResolutionSelector(\n        ResolutionSelector.Builder()\n          .setResolutionStrategy(\n            ResolutionStrategy(\n              android.util.Size(1280, 720),\n              ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER\n            )\n          )\n          .build()\n      )'
        );
        console.log('[withBarcodeScannerFix] Optimized ImageAnalysis resolution to 720p in ExpoCameraView.kt');
      }

      fs.writeFileSync(cameraViewPath, cameraViewContent, 'utf8');

      // Verify and patch BarcodeAnalyzer.kt
      if (!fs.existsSync(analyzerPath)) {
        throw new Error(
          `[withBarcodeScannerFix] Expected BarcodeAnalyzer.kt not found at: ${analyzerPath}`
        );
      }

      let analyzerContent = fs.readFileSync(analyzerPath, 'utf8');

      // Patch constructor to use ML Kit varargs setBarcodeFormats(first, *rest) instead of invalid bitwise-OR reduce
      const unpatchedConstructorRegex = /constructor\(formats: List<BarcodeType>, onComplete: \(BarCodeScannerResult\) -> Unit\) : this\(\s*BarcodeScanning\.getClient\(\s*BarcodeScannerOptions\.Builder\(\)\s*\.setBarcodeFormats\(barcodeFormats\(formats\)\)\s*\.build\(\)\s*\),\s*onComplete\s*\)/;
      const patchedConstructorRegex = /constructor\(formats: List<BarcodeType>, onComplete: \(BarCodeScannerResult\) -> Unit\) : this\(\s*BarcodeScanning\.getClient\(\s*BarcodeScannerOptions\.Builder\(\)\.apply\s*\{/;

      if (patchedConstructorRegex.test(analyzerContent)) {
        console.log('[withBarcodeScannerFix] BarcodeAnalyzer.kt constructor already uses ML Kit varargs (idempotent pass)');
      } else if (unpatchedConstructorRegex.test(analyzerContent)) {
        analyzerContent = analyzerContent.replace(
          unpatchedConstructorRegex,
          'constructor(formats: List<BarcodeType>, onComplete: (BarCodeScannerResult) -> Unit) : this(\n    BarcodeScanning.getClient(\n      BarcodeScannerOptions.Builder().apply {\n        if (formats.isEmpty()) {\n          setBarcodeFormats(com.google.mlkit.vision.barcode.common.Barcode.FORMAT_ALL_FORMATS)\n        } else {\n          setBarcodeFormats(\n            formats.first().mapToBarcode(),\n            *formats.drop(1).map { it.mapToBarcode() }.toIntArray()\n          )\n        }\n      }.build()\n    ),\n    onComplete\n  )'
        );
        console.log('[withBarcodeScannerFix] Successfully patched BarcodeAnalyzer.kt constructor to pass varargs to ML Kit');
      } else {
        throw new Error(
          '[withBarcodeScannerFix] constructor signature not matched in BarcodeAnalyzer.kt'
        );
      }

      // Also ensure barcodeFormats helper defaults to FORMAT_ALL_FORMATS
      const unpatchedAnalyzerRegex = /private fun barcodeFormats\(formats: List<BarcodeType>\): Int =\s*if \(formats\.isEmpty\(\)\) \{\s*0\s*\} else \{/;
      if (unpatchedAnalyzerRegex.test(analyzerContent)) {
        analyzerContent = analyzerContent.replace(
          unpatchedAnalyzerRegex,
          'private fun barcodeFormats(formats: List<BarcodeType>): Int =\n  if (formats.isEmpty()) {\n    com.google.mlkit.vision.barcode.common.Barcode.FORMAT_ALL_FORMATS\n  } else {'
        );
      }

      fs.writeFileSync(analyzerPath, analyzerContent, 'utf8');

      return config;
    },
  ]);

  return config;
}

module.exports = withBarcodeScannerFix;
