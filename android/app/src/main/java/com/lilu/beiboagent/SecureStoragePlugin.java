package com.lilu.beiboagent;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SecureStorage")
public class SecureStoragePlugin extends Plugin {

    private SharedPreferences getEncryptedPrefs() throws Exception {
        MasterKey masterKey = new MasterKey.Builder(getContext())
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();

        return EncryptedSharedPreferences.create(
                getContext(),
                "secure_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        );
    }

    @PluginMethod()
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || value == null) {
            call.reject("key and value are required");
            return;
        }
        try {
            getEncryptedPrefs().edit().putString(key, value).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to save: " + e.getMessage());
        }
    }

    @PluginMethod()
    public void get(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("key is required");
            return;
        }
        try {
            String value = getEncryptedPrefs().getString(key, null);
            JSObject ret = new JSObject();
            ret.put("value", value != null ? value : "");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read: " + e.getMessage());
        }
    }

    @PluginMethod()
    public void remove(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("key is required");
            return;
        }
        try {
            getEncryptedPrefs().edit().remove(key).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to remove: " + e.getMessage());
        }
    }
}
