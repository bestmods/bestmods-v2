import { z } from "zod";
import { router, publicProcedure } from "../trpc";

import fs from 'fs';
import FileType from '../../../utils/base64';
import { TRPCError } from "@trpc/server"

export const sourceRouter = router({
    getSource: publicProcedure.input(z.object({
        url: z.string()
    })).query(({ ctx, input}) => {
        const src = ctx.prisma.source.findFirst({
            where: {
                url: input.url
            }
        });

        return src;
    }),
    addSource: publicProcedure
        .input(
        z.object({
            name: z.string(),
            url: z.string(),
            icon: z.string().nullable(),
            banner: z.string().nullable(),
            classes: z.string().nullable(),
            iremove: z.boolean(),
            bremove: z.boolean()
        })
        )
        .mutation(async ({ ctx, input }) => {
            let src = null;

            // Make sure our URL is valid.
            if (input.url.length < 2) {
                throw new TRPCError({ 
                    code: "PARSE_ERROR",
                    message: "Error parsing URL - URL length is below 2 bytes in size."
                });
            }

            try {
                src = await ctx.prisma.source.upsert({
                    where: {
                        url: input.url
                    },
                    update: {
                        name: input.name,
                        url: input.url,
                        classes: input.classes ?? null,          
                    },
                    create: {
                        name: input.name,
                        url: input.url,
                        classes: input.classes ?? null,
                    }
                });
            } catch (error) {
                console.error("Error creating or updating source.");
                console.error(error);

                throw new TRPCError({ 
                    code: "CONFLICT",
                    message: error
                });
            }

            if (src != null) {
                // Let's now handle file uploads.
                let iconPath = null;
                let bannerPath = null;

                if (input.icon != null && input.icon.length > 0) {
                    const base64Data = input.icon.split(',')[1];

                    if (base64Data != null) {
                        // Retrieve file type.
                        const fileExt = FileType(base64Data);

                        // Make sure we don't have an unknown file type.
                        if (fileExt != "unknown") {
                            // Now let's compile our file name.
                            const fileName = src.url + "." + fileExt;

                            // Set icon path.
                            iconPath = "images/source/" + fileName;

                            // Convert to binary from base64.
                            const buffer = Buffer.from(base64Data, 'base64');

                            // Write file to disk.
                            try {
                                fs.writeFileSync(process.env.PUBLIC_DIR + "/" + iconPath, buffer);
                            } catch (error) {
                                console.error("Error writing icon to disk.");
                                console.error(error);

                                throw new TRPCError({ 
                                    code: "PARSE_ERROR",
                                    message: error
                                });
                            }
                        } else {
                            console.error("Icon's file extension is unknown.");

                            throw new TRPCError({ 
                                code: "PARSE_ERROR",
                                message: error
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

                if (input.banner != null && input.banner.length > 0) {
                    const base64Data = input.banner.split(',')[1];

                    if (base64Data != null) {
                        // Retrieve file type.
                        const fileExt = FileType(base64Data);

                        // Make sure we don't have an unknown file type.
                        if (fileExt != "unknown") {
                            // Now let's compile our file name.
                            const fileName = src.url + "_banner." + fileExt;

                            // Set banner path.
                            bannerPath = "images/source/" + fileName;

                            // Convert to binary from base64.
                            const buffer = Buffer.from(base64Data, 'base64');

                            // Write file to disk.
                            try {
                                fs.writeFileSync(process.env.PUBLIC_DIR + "/" +  bannerPath, buffer);
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
                                message: "Banner's file extension is unknown/not valid."
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
                if ((iconPath != null || bannerPath != null) || (input.iremove || input.bremove)) {
                    // If we're removing the icon or banner, make sure our data is null before updating again.
                    if (input.iremove) {
                        iconPath = null;
                    }

                    if (input.bremove) {
                        bannerPath = null;
                    }

                    try {
                        await ctx.prisma.source.update({
                            where: {
                                url: src.url
                            },
                            data: {
                                icon: iconPath,
                                banner: bannerPath
                            }
                        })
                    } catch (error) {
                        console.error("Error updating source when adding icon and banner.");
                        console.error(error);

                        throw new TRPCError({ 
                            code: "BAD_REQUEST",
                            message: "Error updating source with icon and banner data. " + error
                        });
                    }
                }                
            }
        }),
    getAllSources: publicProcedure.query(({ ctx }) => {
        return ctx.prisma.source.findMany();
    })
});
