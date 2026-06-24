# Capacitor
-keep class com.getcapacitor.** { *; }
-keep class com.owais.myser.** { *; }
-dontwarn com.getcapacitor.**

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ML Kit
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Kotlin coroutines
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# Keep JS interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor plugins
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Capacitor Firebase Auth - ignore missing social providers we don't use
-dontwarn com.facebook.**
-dontwarn com.google.android.play.**
-dontwarn io.capawesome.**
-keep class io.capawesome.** { *; }
-dontwarn org.apache.cordova.**
-keep class org.apache.cordova.** { *; }
