import { z } from 'zod';

export const AddTorrentModeEnum = z.enum(['file', 'magnet']);
export type AddTorrentMode = z.infer<typeof AddTorrentModeEnum>;

export const AddTorrentFormSchema = z.object({
  mode: AddTorrentModeEnum,
  magnetUri: z.string().optional(),
  files: z.array(z.any()).optional(),
  savePath: z.string().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
  sequentialDownload: z.boolean().default(false),
  skipChecking: z.boolean().default(false),
  paused: z.boolean().default(false),
  rootFolder: z.boolean().default(true),
  rename: z.string().optional(),
  upLimit: z.number().optional(),
  dlLimit: z.number().optional(),
  autoTMM: z.boolean().optional(),
  firstLastPiecePrio: z.boolean().optional(),
  contentLayout: z.enum(['Original', 'Subfolder', 'NoSubfolder']).optional(),
  stopCondition: z.enum(['none', 'metadata', 'files']).optional(),
  addToTop: z.boolean().optional(),
});

export type AddTorrentFormData = z.infer<typeof AddTorrentFormSchema>;

export const validateMagnetLink = (uri: string): boolean => {
  return uri.startsWith('magnet:?') || uri.startsWith('http://') || uri.startsWith('https://');
};
