"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pageFrontmatterSchema = exports.ambassadorFrontmatterSchema = exports.summitPageFrontmatterSchema = exports.foundationPageFrontmatterSchema = exports.foundationBlogFrontmatterSchema = void 0;
const zod_1 = require("zod");
exports.foundationBlogFrontmatterSchema = zod_1.z.object({
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    date: zod_1.z.date(),
    slug: zod_1.z.string(),
    pillar: zod_1.z.string().optional(),
    featureImage: zod_1.z.string().optional(),
    featureImageAlt: zod_1.z.string().optional(),
    thumbnailImage: zod_1.z.string().optional(),
    thumbnailImageAlt: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string())
});
exports.foundationPageFrontmatterSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'title is required'),
    slug: zod_1.z.string().min(1, 'slug is required'),
    description: zod_1.z.string().optional(),
    heroTitle: zod_1.z.string().optional(),
    heroDescription: zod_1.z.string().optional(),
    heroImage: zod_1.z.string().optional(),
    sections: zod_1.z
        .array(zod_1.z.object({
        title: zod_1.z.string(),
        content: zod_1.z.string(),
        ctas: zod_1.z
            .array(zod_1.z.object({
            label: zod_1.z.string(),
            href: zod_1.z.string()
        }))
            .optional()
    }))
        .optional(),
    localizes: zod_1.z.string().optional(),
    locale: zod_1.z.string().optional()
});
exports.summitPageFrontmatterSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'title is required'),
    slug: zod_1.z.string().min(1, 'slug is required'),
    description: zod_1.z.string().optional(),
    heroTitle: zod_1.z.string().optional(),
    heroDescription: zod_1.z.string().optional(),
    heroImage: zod_1.z.string().optional(),
    sections: zod_1.z
        .array(zod_1.z.object({
        title: zod_1.z.string(),
        content: zod_1.z.string(),
        ctas: zod_1.z
            .array(zod_1.z.object({
            label: zod_1.z.string(),
            href: zod_1.z.string()
        }))
            .optional()
    }))
        .optional(),
    localizes: zod_1.z.string().optional(),
    locale: zod_1.z.string().optional()
});
exports.ambassadorFrontmatterSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1, 'slug is required'),
    name: zod_1.z.string().nullable().optional(),
    description: zod_1.z.string().nullable().optional(),
    photo: zod_1.z.string().nullable().optional(),
    photoAlt: zod_1.z.string().nullable().optional(),
    linkedinUrl: zod_1.z.string().nullable().optional(),
    grantReportUrl: zod_1.z.string().nullable().optional(),
    locale: zod_1.z.string().optional(),
    localizes: zod_1.z.string().optional()
});
// Legacy export for backward compatibility
exports.pageFrontmatterSchema = exports.foundationPageFrontmatterSchema;
