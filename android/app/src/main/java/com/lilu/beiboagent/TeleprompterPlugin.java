package com.lilu.beiboagent;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Teleprompter")
public class TeleprompterPlugin extends Plugin {

    @PluginMethod()
    public void start(PluginCall call) {
        String text = call.getString("text", "");
        int height = call.getInt("height", 40);
        float size = call.getFloat("size", 22f);
        float speed = call.getFloat("speed", 1.5f);
        boolean mirror = call.getBoolean("mirror", false);

        // 检查悬浮窗权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.reject("需要悬浮窗权限，请授权后重试");
            return;
        }

        Intent serviceIntent = new Intent(getContext(), FloatingTeleprompterService.class);
        serviceIntent.putExtra("text", text);
        serviceIntent.putExtra("height", height);
        serviceIntent.putExtra("size", size);
        serviceIntent.putExtra("speed", speed);
        serviceIntent.putExtra("mirror", mirror);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }
        call.resolve();
    }

    @PluginMethod()
    public void stop(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), FloatingTeleprompterService.class);
        serviceIntent.putExtra("action", "stop");
        getContext().startService(serviceIntent);
        call.resolve();
    }

    @PluginMethod()
    public void hasPermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            ret.put("granted", Settings.canDrawOverlays(getContext()));
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    @PluginMethod()
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }
}
