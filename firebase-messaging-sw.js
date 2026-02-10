// firebase-messaging-sw.js

// 1. SDKの読み込み（compat版を使用）
importScripts('https://www.gstatic.com/firebasejs/10.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.2.0/firebase-messaging-compat.js');

// 2. 初期化
firebase.initializeApp({
    apiKey: "AIzaSyAHlWPBOsmU8X_R8wGNiVlHKxIhpcuUlqY",
    authDomain: "konda-te-menu.firebaseapp.com",
    projectId: "konda-te-menu",
    storageBucket: "konda-te-menu.firebasestorage.app",
    messagingSenderId: "10506812808",
    appId: "1:10506812808:web:a024bd6df2bd3cc7888e3d",
});

// 3. Service Worker 用の Messaging インスタンス取得
const messaging = firebase.messaging();

// バックグラウンド通知の設定
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background message received ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.ico' // 必要に応じてアイコンのパスを指定
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});