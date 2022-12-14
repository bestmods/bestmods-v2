import { z } from "zod";
import { router, publicProcedure } from "../trpc";

import fs from 'fs';
import FileType from '../../../utils/base64';
import { TRPCError } from "@trpc/server"

export const modRouter = router({
    getMod: publicProcedure
        .input(z.object({
            url: z.string()
        }))
        .query(({ ctx, input}) => {
            return ctx.prisma.mod.findFirst({
                    where: {
                        url: input.url
                    }
            });
        }),
    addMod: publicProcedure
        .input(z.object({
            name: z.string(),
            banner: z.string().nullable(),
            url: z.string(),
            category: z.number(),

            // The following should be parsed via Markdown Syntax.
            description: z.string(),
            description_short: z.string(),
            install: z.string().nullable(),

            // The following should be parsed via JSON.
            downloads: z.string().nullable(),
            screenshots: z.string().nullable(),
            sources: z.string().nullable(),

            bremove: z.boolean().nullable()
        }))
        .mutation(async ({ ctx, input }) => {
            // First, we want to insert the mod into the database.
            let mod = null;

            try {
                mod = await ctx.prisma.mod.upsert({
                    where: {
                        url: input.url
                    },
                    include: {
                        ModSource: true
                    },
                    update: {
                        name: input.name,
                        url: input.url,
                        categoryId: input.category,

                        description: input.description,
                        description_short: input.description_short,
                        install: input.install
                    },
                    create: {
                        name: input.name,
                        url: input.url,
                        categoryId: input.category,

                        description: input.description,
                        description_short: input.description_short,
                        install: input.install
                    }
                });
            } catch (error) {
                console.error("Error creating or updating mod.");
                console.error(error);

                throw new TRPCError({ 
                    code: "CONFLICT",
                    message: error
                });
            }

            if (mod != null) {
                // Handle downloads relation.
                const downloads = JSON.parse(input.downloads ?? "[]");

                // Loop through downloads.
                downloads.forEach(async ({ name, url }: { name: string, url: string }) => {
                    const results = await ctx.prisma.modDownload.upsert({
                        where: {
                            modurl: mod.url,
                            url: url
                        },
                        create: {
                            modurl: mod.url,
                            name: name,
                            url: url,
                        },
                        update: {
                            name: name,
                            url: url
                        }
                    });
                });

                // Handle screenshots relation.
                const screenshots = JSON.parse(input.screenshots ?? "[]");

                // Loop through screenshots.
                screenshots.forEach(async ({ url }: { url: string }) => {
                    const results = await ctx.prisma.modScreenshot.upsert({
                        where: {
                            modurl: mod.url,
                            url: url
                        },
                        create: {
                            modurl: mod.url,
                            url: url,
                        },
                        update: {
                            url: url
                        }
                    });
                });

                // Handle sources relation.
                const sources = JSON.parse(input.sources ?? "[]");

                // Loop through sources.
                sources.forEach(async ({ srcurl, url }: { srcurl: string, url: string }) => {
                    const results = await ctx.prisma.modSource.upsert({
                        where: {
                            modurl: mod.url,
                            sourceUrl: srcurl
                        },
                        create: {
                            modurl: mod.url,
                            sourceUrl: srcurl,
                            url: url,
                        },
                        update: {
                            url: url
                        }
                    });
                });

                // Let's now handle file uploads.
                let bannerPath = null;

                if (input.banner != null && input.banner.length > 0) {
                    const base64Data = input.banner.split(',')[1];

                    if (base64Data != null) {
                        // Retrieve file type.
                        const fileExt = FileType(base64Data);

                        // Make sure we don't have an-++ unknown file type.
                        if (fileExt != "unknown") {
                            // Now let's compile our file name.
                            const fileName = mod.url + "." + fileExt;

                            // Set icon path.
                            bannerPath = "images/mods/" + fileName;

                            // Convert to binary from base64.
                            const buffer = Buffer.from(base64Data, 'base64');

                            // Write file to disk.
                            try {
                                fs.writeFileSync(process.env.PUBLIC_DIR + "/" + bannerPath, buffer);
                            } catch (error) {
                                console.error("Error writing banner to disk.");
                                console.error(error);

                                throw new TRPCError({ 
                                    code: "PARSE_ERROR",
                                    message: error
                                });
                            }
                        } else {
                            console.error("Banner's file extension is unknown.");

                            throw new TRPCError({ 
                                code: "PARSE_ERROR",
                                message: "Unknown file extension for banner."
                            });
                        }
                    } else {
                        console.error("Parsing base64 data is null.");

                        throw new TRPCError({ 
                            code: "PARSE_ERROR",
                            message: "Unable to process banner's Base64 data."
                        });
                    }
                }

                // If we have a file upload, update database.
                if (bannerPath != null || input.bremove) {
                    // If we're removing the banner, make sure our data is null before updating again.
                    if (input.bremove) {
                        bannerPath = null;
                    }

                    try {
                        await ctx.prisma.mod.update({
                            where: {
                                url: mod.url
                            },
                            data: {
                                banner: bannerPath
                            }
                        })
                    } catch (error) {
                        console.error("Error updating mod when adding banner.");
                        console.error(error);

                        throw new TRPCError({ 
                            code: "BAD_REQUEST",
                            message: "Error updating mod with icon and banner data. " + error
                        });
                    }
                }                
            }
        }),
    getAllModsLimit: publicProcedure
        .input(z.object({
            url: z.string(),
            offset: z.number().nullable(),
            count: z.number().nullable()
            
        }))
        .query(({ ctx, input }) => {
            const offset = input.offset ?? 0;
            const count = input.count ?? 10;

            return ctx.prisma.mod.findMany({
                where: {
                    url: input.url
                },
                skip: offset,
                take: count
            });
        }),
    getAllMods: publicProcedure
        .query(({ ctx }) => {
            return ctx.prisma.mod.findMany();
        }),
});
