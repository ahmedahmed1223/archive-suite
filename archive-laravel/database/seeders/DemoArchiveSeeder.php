<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds demo archive content into `storage_rows` (store = "archive").
 *
 * Each record carries a content type (نوع), a section/department (قسم) and a
 * classification (تصنيف) so the Next surfaces (/archive, /search, /analytics)
 * render populated, realistic Arabic demo data out of the box.
 *
 * Idempotent: keyed on (store, uid) via updateOrInsert — safe to re-run.
 * Not wired into DatabaseSeeder by default; enable with SEED_DEMO_DATA=true
 * or run directly: `php artisan db:seed --class=DemoArchiveSeeder`.
 */
class DemoArchiveSeeder extends Seeder
{
    /** Content types (الأنواع). */
    private const TYPES = [
        ['type' => 'video', 'label' => 'فيديو'],
        ['type' => 'image', 'label' => 'صورة'],
        ['type' => 'document', 'label' => 'وثيقة'],
        ['type' => 'audio', 'label' => 'تسجيل صوتي'],
        ['type' => 'map', 'label' => 'خريطة'],
    ];

    /** Sections / departments (الأقسام). */
    private const SECTIONS = ['الأخبار', 'الرياضة', 'الثقافة', 'الوثائقية', 'الاقتصاد', 'المحليات'];

    /** Classifications (التصنيفات). */
    private const CLASSIFICATIONS = ['عام', 'أرشيف تاريخي', 'حصري', 'مقيّد', 'قيد المراجعة'];

    /** Subject seeds: [title, description, tags]. */
    private const SUBJECTS = [
        ['افتتاح المعرض الوطني للتراث', 'تغطية مصوّرة لافتتاح المعرض السنوي للتراث الوطني.', ['تراث', 'معرض', 'وطني']],
        ['مباراة نهائي كأس المحترفين', 'ملخص وأهداف مباراة النهائي مع مقابلات اللاعبين.', ['كرة قدم', 'نهائي', 'كأس']],
        ['وثائقي عن الطرق التاريخية', 'فيلم وثائقي يوثّق طرق القوافل القديمة.', ['وثائقي', 'تاريخ', 'قوافل']],
        ['مؤتمر الاقتصاد الرقمي', 'كلمات وجلسات مؤتمر الاقتصاد الرقمي السنوي.', ['اقتصاد', 'تقنية', 'مؤتمر']],
        ['أمسية شعرية في دار الثقافة', 'تسجيل صوتي كامل للأمسية الشعرية.', ['شعر', 'ثقافة', 'أمسية']],
        ['خريطة توزيع المواقع الأثرية', 'خريطة تفاعلية لمواقع أثرية موثّقة.', ['خريطة', 'آثار', 'مواقع']],
        ['تقرير حالة الطقس الموسمي', 'نشرة مصوّرة عن الحالة الجوية الموسمية.', ['طقس', 'نشرة', 'موسم']],
        ['حوار مع رائدة أعمال محلية', 'مقابلة معمّقة ضمن سلسلة قصص النجاح.', ['حوار', 'ريادة', 'أعمال']],
        ['مهرجان الأفلام القصيرة', 'لقطات من فعاليات مهرجان الأفلام القصيرة.', ['أفلام', 'مهرجان', 'قصيرة']],
        ['وثيقة تأسيس البلدية', 'نسخة رقمية من وثيقة تأسيس البلدية التاريخية.', ['وثيقة', 'بلدية', 'تأسيس']],
        ['بطولة ألعاب القوى', 'تغطية شاملة لبطولة ألعاب القوى.', ['ألعاب قوى', 'بطولة', 'رياضة']],
        ['ندوة عن الأمن الغذائي', 'جلسة نقاش حول سياسات الأمن الغذائي.', ['أمن غذائي', 'ندوة', 'سياسات']],
        ['صور جوية للمنطقة الساحلية', 'مجموعة صور جوية توثّق التوسّع العمراني.', ['صور جوية', 'ساحل', 'عمران']],
        ['برنامج إذاعي عن الموروث الشعبي', 'حلقة إذاعية عن الحكايات الشعبية.', ['إذاعة', 'موروث', 'شعبي']],
        ['تقرير عن مشاريع البنية التحتية', 'استعراض مصوّر لمشاريع البنية التحتية.', ['بنية تحتية', 'مشاريع', 'تنمية']],
        ['معرض الفنون التشكيلية', 'جولة مصوّرة في معرض الفنون التشكيلية.', ['فنون', 'تشكيلي', 'معرض']],
        ['محاضرة في تاريخ العمارة', 'محاضرة مسجّلة عن تطور العمارة المحلية.', ['عمارة', 'محاضرة', 'تاريخ']],
        ['تغطية موسم الحصاد', 'تقرير ميداني عن موسم الحصاد الزراعي.', ['زراعة', 'حصاد', 'موسم']],
        ['بث مباشر لحفل التخرج', 'تسجيل البث المباشر لحفل التخرج السنوي.', ['تخرج', 'حفل', 'بث']],
        ['أرشيف الصحف القديمة', 'نسخ ممسوحة ضوئياً من أعداد صحفية قديمة.', ['صحف', 'أرشيف', 'مسح']],
        ['مقابلة مع مؤرخ المدينة', 'حوار حول تاريخ المدينة ومعالمها.', ['مؤرخ', 'مدينة', 'معالم']],
        ['ورشة عمل عن التصوير الوثائقي', 'توثيق ورشة تدريبية في التصوير الوثائقي.', ['تصوير', 'ورشة', 'تدريب']],
        ['تقرير عن السياحة البيئية', 'تحقيق مصوّر عن مواقع السياحة البيئية.', ['سياحة', 'بيئة', 'تحقيق']],
        ['حفل موسيقي للفرقة الوطنية', 'تسجيل الحفل الموسيقي للفرقة الوطنية.', ['موسيقى', 'حفل', 'فرقة']],
    ];

    public function run(): void
    {
        $now = now();

        foreach (self::SUBJECTS as $index => [$title, $description, $tags]) {
            $type = self::TYPES[$index % count(self::TYPES)];
            $section = self::SECTIONS[$index % count(self::SECTIONS)];
            $classification = self::CLASSIFICATIONS[$index % count(self::CLASSIFICATIONS)];
            $uid = sprintf('demo-archive-%03d', $index + 1);
            // Spread created dates across the recent past for realistic timelines.
            $created = $now->copy()->subDays(($index + 1) * 27);

            $data = [
                'id' => $uid,
                'title' => $title,
                'description' => $description,
                'type' => $type['type'],
                'subtype' => null,
                'tags' => array_values(array_unique([...$tags, $section, $classification])),
                'section' => $section,
                'classification' => $classification,
                'metadata' => [
                    'typeLabel' => $type['label'],
                    'section' => $section,
                    'classification' => $classification,
                    'source' => 'DemoArchiveSeeder',
                ],
                'createdAt' => $created->toIso8601String(),
                'updatedAt' => $created->toIso8601String(),
            ];

            DB::table('storage_rows')->updateOrInsert(
                ['store' => 'archive', 'uid' => $uid],
                [
                    'data' => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                    'sync_version' => 1,
                    'last_modified_by' => json_encode(['source' => 'DemoArchiveSeeder'], JSON_UNESCAPED_UNICODE),
                    'created_at' => $created,
                    'updated_at' => $created,
                ]
            );
        }
    }
}
