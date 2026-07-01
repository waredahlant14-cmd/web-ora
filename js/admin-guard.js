/* =========================================================
   js/admin-guard.js — حاجز حماية الصفحات المخصصة للمدير
   أضف هذا الملف بعد auth.js في أي صفحة محمية
   ========================================================= */
(function () {
  function check() {
    var u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;

    /* غير مسجّل الدخول ← إلى صفحة تسجيل الدخول */
    if (!u) { window.location.replace('login.html'); return; }

    /* مسجّل لكن ليس مديراً ← عرض شاشة الرفض */
    if (u.role !== 'admin') {
      document.addEventListener('DOMContentLoaded', function () {
        /* إخفاء محتوى الصفحة */
        var page = document.getElementById('page');
        if (page) page.style.display = 'none';

        /* شاشة الرفض */
        var overlay = document.createElement('div');
        overlay.id = 'access-denied-overlay';
        overlay.style.cssText = [
          'position:fixed', 'inset:0', 'z-index:9999',
          'display:flex', 'flex-direction:column',
          'align-items:center', 'justify-content:center',
          'gap:16px', 'background:var(--bg,#0f172a)',
          'color:var(--text,#f1f5f9)', 'font-family:inherit',
          'text-align:center', 'padding:24px'
        ].join(';');

        overlay.innerHTML =
          '<div style="font-size:56px">🔒</div>' +
          '<h2 style="margin:0;font-size:22px;font-weight:700">ممنوع الوصول</h2>' +
          '<p style="margin:0;font-size:14px;color:#94a3b8;max-width:320px">' +
            'هذه الصفحة مخصصة للمدير فقط.<br>لا تملك صلاحية الدخول إليها.' +
          '</p>' +
          '<button onclick="history.back()" style="' +
            'margin-top:8px;padding:10px 28px;border-radius:8px;border:none;' +
            'background:#3b82f6;color:#fff;font-size:14px;font-weight:600;' +
            'cursor:pointer' +
          '">← العودة للخلف</button>';

        document.body.appendChild(overlay);
      });
    }
  }

  /* تأكد من تحميل auth.js أولاً */
  if (typeof getCurrentUser === 'function') {
    check();
  } else {
    document.addEventListener('DOMContentLoaded', check);
  }
})();
