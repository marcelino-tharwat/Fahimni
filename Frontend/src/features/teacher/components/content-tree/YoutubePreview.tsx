import { motion, AnimatePresence } from 'framer-motion';
import { Play } from 'lucide-react';

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractVideoId(url: string): string | null {
  const match = url.trim().match(YOUTUBE_REGEX);
  return match?.[1] ?? null;
}

interface YoutubePreviewProps {
  url: string;
}

export function YoutubePreview({ url }: YoutubePreviewProps) {
  const videoId = url ? extractVideoId(url) : null;

  if (!videoId) return null;

  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <AnimatePresence>
      <motion.div
        key={videoId}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="relative mt-3 overflow-hidden rounded-lg"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <img
            src={thumbnail}
            alt="Video thumbnail"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360"><rect fill="%23f3f4f6" width="480" height="360"/><text x="240" y="180" text-anchor="middle" fill="%239ca3af" font-size="14">No thumbnail</text></svg>';
            }}
          />
          <motion.div
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
            whileHover={{ scale: 1.05 }}
            onClick={() => window.open(`https://youtube.com/watch?v=${videoId}`, '_blank')}
          >
            <motion.div
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg"
              whileTap={{ scale: 0.95 }}
            >
              <Play size={24} fill="white" className="ml-0.5" />
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
