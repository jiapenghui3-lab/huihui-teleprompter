package com.lilu.beiboagent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public class FloatingTeleprompterService extends Service {

    private WindowManager windowManager;
    private View floatingView;
    private ScrollView scrollView;
    private TextView textView;
    private Handler scrollHandler;
    private Runnable scrollRunnable;
    private boolean isScrolling = false;
    private float scrollSpeed = 1.5f;
    private float textSize = 22f;
    private int overlayHeight = 0;
    private boolean mirrorMode = false;

    private static final String CHANNEL_ID = "tp_channel";

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getStringExtra("action");
        if ("stop".equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if ("updateSpeed".equals(action)) {
            scrollSpeed = intent.getFloatExtra("speed", 1.5f);
            return START_STICKY;
        }

        if ("updateSize".equals(action)) {
            textSize = intent.getFloatExtra("size", 22f);
            if (textView != null) textView.setTextSize(textSize);
            return START_STICKY;
        }

        if ("toggleScroll".equals(action)) {
            if (isScrolling) stopScroll(); else startScroll();
            return START_STICKY;
        }

        String text = intent.getStringExtra("text");
        overlayHeight = intent.getIntExtra("height", 40);
        textSize = intent.getFloatExtra("size", 22f);
        scrollSpeed = intent.getFloatExtra("speed", 1.5f);
        mirrorMode = intent.getBooleanExtra("mirror", false);

        if (floatingView != null) {
            windowManager.removeView(floatingView);
            floatingView = null;
        }

        createNotificationChannel();
        Notification notification = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("辉辉提词器")
                .setContentText("提词器运行中")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(1, notification);
        }

        createFloatingWindow(text != null ? text : "");
        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "提词器", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void createFloatingWindow(String text) {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        int windowHeight = screenHeight * overlayHeight / 100;

        // 外层容器
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setBackgroundColor(Color.argb(60, 0, 0, 0)); // 非常透明的黑底

        // 顶部拖动手柄
        LinearLayout dragHandle = new LinearLayout(this);
        dragHandle.setOrientation(LinearLayout.HORIZONTAL);
        dragHandle.setGravity(Gravity.CENTER);
        dragHandle.setBackgroundColor(Color.argb(100, 0, 0, 0));
        dragHandle.setPadding(0, 14, 0, 14);
        // 拖动指示条（小横杠）
        TextView handleBar = new TextView(this);
        handleBar.setText("━━━━━━━━");
        handleBar.setTextColor(Color.argb(150, 255, 255, 255));
        handleBar.setTextSize(12);
        handleBar.setGravity(Gravity.CENTER);
        dragHandle.addView(handleBar);

        // 滚动区
        scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);

        textView = new TextView(this);
        textView.setText(text);
        textView.setTextSize(textSize);
        textView.setTextColor(Color.WHITE);
        textView.setLineSpacing(8f, 1.4f);
        textView.setPadding(40, 30, 40, 30);
        textView.setShadowLayer(4f, 1f, 1f, Color.BLACK); // 文字阴影增强可读性

        scrollView.addView(textView);

        // 镜像模式：水平翻转文字
        if (mirrorMode) {
            textView.setScaleX(-1);
        }

        // 底部控制条
        LinearLayout controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setGravity(Gravity.CENTER);
        controls.setBackgroundColor(Color.argb(80, 0, 0, 0));
        controls.setPadding(16, 12, 16, 12);

        String[] labels = {"A-", "A+", "▶", "慢", "快", "✕"};
        for (String label : labels) {
            TextView btn = new TextView(this);
            btn.setText(label);
            btn.setTextColor(Color.WHITE);
            btn.setTextSize(20);
            btn.setPadding(36, 20, 36, 20);
            btn.setGravity(Gravity.CENTER);

            final String l = label;
            btn.setOnClickListener(v -> {
                switch (l) {
                    case "A-": textSize = Math.max(14, textSize - 2); textView.setTextSize(textSize); break;
                    case "A+": textSize = Math.min(50, textSize + 2); textView.setTextSize(textSize); break;
                    case "▶": case "⏸":
                        if (isScrolling) { stopScroll(); btn.setText("▶"); }
                        else { startScroll(); btn.setText("⏸"); }
                        break;
                    case "慢": scrollSpeed = Math.max(0.5f, scrollSpeed - 0.5f); break;
                    case "快": scrollSpeed = Math.min(5f, scrollSpeed + 0.5f); break;
                    case "✕": stopSelf(); break;
                }
            });
            controls.addView(btn);
        }

        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f);
        container.addView(dragHandle, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        container.addView(scrollView, scrollParams);
        container.addView(controls, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        floatingView = container;

        int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        final WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                windowHeight,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = 0;
        params.y = 0;

        windowManager.addView(floatingView, params);

        // 拖动手柄控制整个窗口位置
        dragHandle.setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x;
                        initialY = params.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        params.x = initialX + (int) (event.getRawX() - initialTouchX);
                        params.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(floatingView, params);
                        return true;
                    case MotionEvent.ACTION_UP:
                        return true;
                }
                return false;
            }
        });

        scrollHandler = new Handler(Looper.getMainLooper());
    }

    private void startScroll() {
        isScrolling = true;
        scrollRunnable = new Runnable() {
            @Override
            public void run() {
                if (scrollView != null && isScrolling) {
                    scrollView.scrollBy(0, (int)(scrollSpeed * 2));
                    scrollHandler.postDelayed(this, 30);
                }
            }
        };
        scrollHandler.post(scrollRunnable);
    }

    private void stopScroll() {
        isScrolling = false;
        if (scrollHandler != null && scrollRunnable != null) {
            scrollHandler.removeCallbacks(scrollRunnable);
        }
    }

    @Override
    public void onDestroy() {
        stopScroll();
        if (floatingView != null && windowManager != null) {
            windowManager.removeView(floatingView);
        }
        super.onDestroy();
    }
}
