// ==========================================
// Parse Cloud Code - Advanced Examples
// ==========================================

// 1. دالة Cloud بسيطة
Parse.Cloud.define("hello", (request) => {
  return "Hello from Cloud Code!";
});

// 2. دالة Cloud مع معاملات
Parse.Cloud.define("greet", (request) => {
  const { name } = request.params;
  return `Hello, ${name}!`;
});

// 3. دالة Cloud مع قاعدة البيانات
Parse.Cloud.define("getUserCount", async (request) => {
  const query = new Parse.Query(Parse.User);
  const count = await query.count();
  return { userCount: count };
});

// 4. دالة Cloud مع الصلاحيات الكاملة
Parse.Cloud.define("createObject", async (request) => {
  const { className, data } = request.params;
  const object = new Parse.Object(className);
  
  // تعيين البيانات
  for (const key in data) {
    object.set(key, data[key]);
  }
  
  // حفظ مع صلاحيات كاملة
  await object.save(null, { useMasterKey: true });
  return { success: true, objectId: object.id };
});

// 5. دالة Cloud للبحث
Parse.Cloud.define("search", async (request) => {
  const { className, key, value } = request.params;
  const query = new Parse.Query(className);
  query.equalTo(key, value);
  const results = await query.find({ useMasterKey: true });
  return results;
});

// 6. دالة Cloud للتحديث
Parse.Cloud.define("updateObject", async (request) => {
  const { className, objectId, data } = request.params;
  const query = new Parse.Query(className);
  const object = await query.get(objectId, { useMasterKey: true });
  
  // تحديث البيانات
  for (const key in data) {
    object.set(key, data[key]);
  }
  
  await object.save(null, { useMasterKey: true });
  return { success: true, objectId: object.id };
});

// 7. دالة Cloud للحذف
Parse.Cloud.define("deleteObject", async (request) => {
  const { className, objectId } = request.params;
  const query = new Parse.Query(className);
  const object = await query.get(objectId, { useMasterKey: true });
  await object.destroy({ useMasterKey: true });
  return { success: true, message: 'Object deleted' };
});

// 8. دالة Cloud للاستعلام المتقدم
Parse.Cloud.define("advancedQuery", async (request) => {
  const { className, where, limit = 100, skip = 0 } = request.params;
  const query = new Parse.Query(className);
  
  // تطبيق الشروط
  if (where) {
    for (const key in where) {
      const condition = where[key];
      if (condition.$gt !== undefined) query.greaterThan(key, condition.$gt);
      if (condition.$lt !== undefined) query.lessThan(key, condition.$lt);
      if (condition.$eq !== undefined) query.equalTo(key, condition.$eq);
      if (condition.$ne !== undefined) query.notEqualTo(key, condition.$ne);
    }
  }
  
  query.limit(limit);
  query.skip(skip);
  
  const results = await query.find({ useMasterKey: true });
  return {
    count: results.length,
    results: results
  };
});

// 9. Hook - قبل الحفظ
Parse.Cloud.beforeSave("GameScore", (request) => {
  const object = request.object;
  
  // التحقق من الصحة
  if (object.get("score") < 0) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, "Score cannot be negative");
  }
  
  // إضافة timestamp
  object.set("lastModified", new Date());
});

// 10. Hook - بعد الحفظ
Parse.Cloud.afterSave("GameScore", (request) => {
  console.log(`GameScore saved: ${request.object.id}`);
});

// 11. Hook - قبل الحذف
Parse.Cloud.beforeDelete("GameScore", (request) => {
  console.log(`GameScore will be deleted: ${request.object.id}`);
});

// 12. Hook - بعد الحذف
Parse.Cloud.afterDelete("GameScore", (request) => {
  console.log(`GameScore deleted: ${request.object.id}`);
});

// 13. دالة Cloud للإحصائيات
Parse.Cloud.define("getStats", async (request) => {
  const { className } = request.params;
  const query = new Parse.Query(className);
  const count = await query.count({ useMasterKey: true });
  
  return {
    className: className,
    totalCount: count,
    timestamp: new Date().toISOString()
  };
});

// 14. دالة Cloud للتصدير
Parse.Cloud.define("exportData", async (request) => {
  const { className, limit = 1000 } = request.params;
  const query = new Parse.Query(className);
  query.limit(limit);
  
  const results = await query.find({ useMasterKey: true });
  const data = results.map(obj => obj.toJSON());
  
  return {
    className: className,
    count: data.length,
    data: data
  };
});

// 15. دالة Cloud للاستيراد
Parse.Cloud.define("importData", async (request) => {
  const { className, data } = request.params;
  
  if (!Array.isArray(data)) {
    throw new Parse.Error(Parse.Error.INVALID_JSON, "Data must be an array");
  }
  
  const results = [];
  for (const item of data) {
    const object = new Parse.Object(className);
    for (const key in item) {
      object.set(key, item[key]);
    }
    await object.save(null, { useMasterKey: true });
    results.push(object.id);
  }
  
  return {
    success: true,
    imported: results.length,
    ids: results
  };
});

// 16. دالة Cloud للتحقق من الصحة
Parse.Cloud.define("validate", (request) => {
  const { data } = request.params;
  
  if (!data || typeof data !== 'object') {
    throw new Parse.Error(Parse.Error.INVALID_JSON, "Invalid data format");
  }
  
  return { valid: true, message: "Data is valid" };
});

// 17. دالة Cloud للبحث النصي
Parse.Cloud.define("textSearch", async (request) => {
  const { className, searchTerm, field } = request.params;
  const query = new Parse.Query(className);
  
  // البحث النصي (يتطلب فهرس نصي في MongoDB)
  query.contains(field, searchTerm);
  
  const results = await query.find({ useMasterKey: true });
  return results;
});

// 18. دالة Cloud للترتيب
Parse.Cloud.define("getSorted", async (request) => {
  const { className, sortBy, order = "ascending" } = request.params;
  const query = new Parse.Query(className);
  
  if (order === "descending") {
    query.descending(sortBy);
  } else {
    query.ascending(sortBy);
  }
  
  const results = await query.find({ useMasterKey: true });
  return results;
});

// 19. دالة Cloud للتجميع
Parse.Cloud.define("aggregate", async (request) => {
  const { className } = request.params;
  const query = new Parse.Query(className);
  
  const results = await query.find({ useMasterKey: true });
  
  return {
    total: results.length,
    timestamp: new Date().toISOString(),
    className: className
  };
});

// 20. دالة Cloud للإشعارات
Parse.Cloud.define("sendNotification", async (request) => {
  const { title, message, target } = request.params;
  
  // يمكن إضافة منطق الإشعارات هنا
  console.log(`Notification: ${title} - ${message} to ${target}`);
  
  return {
    success: true,
    message: "Notification sent"
  };
});

console.log("✅ Cloud Code loaded successfully!");
