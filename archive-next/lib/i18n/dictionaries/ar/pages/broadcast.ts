export const broadcast = {
  errors:{ refresh:"تعذر تحديث غرفة البث.", lock:"تعذر تحديث قفل التحكم.", save:"تعذر حفظ الراندون.", operation:"تعذر تنفيذ العملية" },
  messages:{ rundownUnloaded:"لم يتم تحميل الراندون بعد", ready:"جاهز", lastHeartbeat:"آخر نبضة: {time}", latestRundown:"تم تحميل آخر راندون", newRundown:"راندون جديد", lockReleased:"تم تحرير قفل التحكم.", lockReserved:"تم حجز قفل التحكم لهذه المادة.", saved:"تم الحفظ: {time}" },
  toolbar:{ eyebrow:"محاكاة محلية", title:"غرفة بث ومراجعة تشغيلية", description:"ساعة بث، حضور، قفل تحكم، راندون مشترك، وملاحظات زمنية فوق واجهات التعاون والمراجعة نفسها.", participants:"{count} مشارك", safetyAction:"مراجعة محاكاة البث" },
  settings:{ aria:"إعدادات غرفة البث", room:"الغرفة", mediaPath:"مسار/معرف المادة", status:"الحالة", viewing:"مشاهدة", reviewing:"مراجعة", editing:"تحرير" },
  player:{ aria:"المشغل ومحاكاة البث", title:"المشغل", refresh:"تحديث", mediaTitle:"مصدر البث المحلي", emptyTitle:"أدخل مسار مادة للبدء", emptyDescription:"تستخدم المحاكاة مسار الملف نفسه كمورد للمراجعة والقفل.", playback:"حالة التشغيل", playing:"تشغيل", stopped:"متوقف", controlLock:"قفل التحكم", available:"متاح", releaseLock:"تحرير قفل التحكم", reserveLock:"حجز قفل التحكم" },
  presence:{ aria:"الحضور والراندون", title:"الحضور", description:"تعمل عبر نبضات الحضور مع Reverb عند توفره.", empty:"لا يوجد حضور نشط بعد." },
  rundown:{ title:"الراندون", placeholder:"00:00 افتتاحية\n00:30 لقطة رئيسية\n01:15 ملاحظة للمونتاج", saving:"جارٍ الحفظ...", save:"حفظ الراندون" },
  notes:{ aria:"ملاحظات زمنية", title:"ملاحظات التشغيل", description:"ترتبط الملاحظة بالوقت الحالي في المشغل.", label:"الملاحظة", time:"الوقت", add:"إضافة ملاحظة", empty:"لا توجد ملاحظات بعد." }
} as const;
