/* =========================================================
   js/permissions.js — طبقة بيانات الصلاحيات v1.0
   ========================================================= */

var LS_PERMISSIONS = "acc_permissions";

var PAGES_LIST = [
  { key: "new",        label: "فاتورة جديدة"    },
  { key: "invoices",   label: "سجل الفواتير"    },
  { key: "products",   label: "المنتجات"        },
  { key: "customers",  label: "العملاء"         },
  { key: "stock",      label: "المخزون"         },
  { key: "expenses",   label: "المصاريف"        },
  { key: "employees",  label: "الموظفون"        },
  { key: "reports",    label: "التقارير"        },
  { key: "activity",   label: "سجل النشاطات"   },
  { key: "offers",     label: "العروض"          },
  { key: "shifts",     label: "الورديات"        },
  { key: "suppliers",  label: "الموردون"        },
  { key: "customer-statement", label: "كشف الآجل" },
];

var DEFAULT_CASHIER_PERMS = (function () {
  var d = {};
  PAGES_LIST.forEach(function (p) {
    d[p.key] = { canView: true, canAdd: true, canEdit: false, canDelete: false };
  });
  /* القيود الافتراضية */
  d["reports"]   = { canView: false, canAdd: false, canEdit: false, canDelete: false };
  d["activity"]  = { canView: false, canAdd: false, canEdit: false, canDelete: false };
  d["employees"] = { canView: false, canAdd: false, canEdit: false, canDelete: false };
  d["suppliers"] = { canView: true,  canAdd: true,  canEdit: false, canDelete: false };
  return d;
})();

async function getPermissions(role) {
  if (await sbReady()) {
    var r = await SB.from("permissions").select("*").eq("role", role);
    if (r.data && r.data.length) {
      var perms = {};
      r.data.forEach(function (row) {
        perms[row.page] = {
          canView:   !!row.can_view,
          canAdd:    !!row.can_add,
          canEdit:   !!row.can_edit,
          canDelete: !!row.can_delete
        };
      });
      return perms;
    }
  }
  var local = lsGet(LS_PERMISSIONS, {});
  return local[role] || (role === "cashier" ? DEFAULT_CASHIER_PERMS : {});
}

async function savePermissions(role, perms) {
  var local = lsGet(LS_PERMISSIONS, {});
  local[role] = perms;
  lsSet(LS_PERMISSIONS, local);

  if (await sbReady()) {
    var rows = Object.keys(perms).map(function (page) {
      return {
        role: role, page: page,
        can_view:   perms[page].canView   || false,
        can_add:    perms[page].canAdd    || false,
        can_edit:   perms[page].canEdit   || false,
        can_delete: perms[page].canDelete || false
      };
    });
    await SB.from("permissions")
      .upsert(rows, { onConflict: "role,page" });
  }
  logActivity("admin", "تم تحديث صلاحيات الدور: " + role);
}

/* التحقق من صلاحية معينة للمستخدم الحالي */
async function checkPermission(page, action) {
  var user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
  if (!user) return false;
  if (user.role === "admin") return true;
  var perms = await getPermissions(user.role);
  var p = perms[page];
  if (!p) return false;
  if (action === "view")   return !!p.canView;
  if (action === "add")    return !!p.canAdd;
  if (action === "edit")   return !!p.canEdit;
  if (action === "delete") return !!p.canDelete;
  return false;
}

/* يُستدعى في بداية كل صفحة محمية */
async function requirePermission(page) {
  var allowed = await checkPermission(page, "view");
  if (!allowed) {
    document.body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;font-family:Cairo,sans-serif">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
      '<h2 style="color:#111827;font-size:20px;font-weight:700">غير مصرح</h2>' +
      '<p style="color:#6B7280">ليس لديك صلاحية للوصول إلى هذه الصفحة.</p>' +
      '<a href="index.html" style="background:#F57C20;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600">العودة للرئيسية</a>' +
      '</div>';
    return false;
  }
  return true;
}
