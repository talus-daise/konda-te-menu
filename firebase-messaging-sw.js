// firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.2.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAHlWPBOsmU8X_R8wGNiVlHKxIhpcuUlqY",
    authDomain: "konda-te-menu.firebaseapp.com",
    projectId: "konda-te-menu",
    storageBucket: "konda-te-menu.firebasestorage.app",
    messagingSenderId: "10506812808",
    appId: "1:10506812808:web:a024bd6df2bd3cc7888e3d",
});

// インスタンスを取得するだけでOK。
// SDKがバックグラウンドでの通知表示を自動でハンドリングします。
const messaging = firebase.messaging();