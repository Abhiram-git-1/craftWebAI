import { z } from "zod";

const filePathSchema = z
  .string()
  .min(1)
  .max(180)
  .refine(
    (value) =>
      !value.includes("\\") &&
      !value.startsWith("/") &&
      !/^[a-zA-Z]:/.test(value),
    "File path must be relative and use forward slashes.",
  )
  .refine(
    (value) =>
      value.split("/").every((part) => part && part !== "." && part !== ".."),
    "File path contains an unsafe segment.",
  )
  .refine(
    (value) => !value.includes("\0"),
    "File path contains an invalid character.",
  );

export const planSchema = z
  .object({
    siteName: z.string().min(1).max(80),
    summary: z.string().min(1).max(500),
    design: z.object({
      style: z.string().min(1).max(100),
      colorPalette: z.array(z.string().min(1).max(40)).min(2).max(8),
      typography: z.string().min(1).max(120),
      layout: z.string().min(1).max(300),
    }),
    pages: z
      .array(
        z.object({
          name: z.string().min(1).max(60),
          path: z.string().min(1).max(100),
          purpose: z.string().min(1).max(300),
        }),
      )
      .min(1)
      .max(8),
    components: z
      .array(
        z.object({
          name: z.string().min(1).max(80),
          purpose: z.string().min(1).max(250),
        }),
      )
      .max(20),
    features: z.array(z.string().min(1).max(160)).max(20),
    fileManifest: z
      .array(
        z.object({
          path: filePathSchema,
          purpose: z.string().min(1).max(250),
        }),
      )
      .min(1)
      .max(20),
  })
  .strict();

export const generatedFilesSchema = z
  .object({
    files: z
      .array(
        z
          .object({
            path: filePathSchema,
            content: z.string().max(300000),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((value, ctx) => {
    const paths = value.files.map((file) => file.path);
    if (new Set(paths).size !== paths.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Generated file paths must be unique.",
      });
    }
  });
