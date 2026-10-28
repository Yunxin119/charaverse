import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge only knows Tailwind's stock scales; teach it our `--cv-*` design tokens
 * so a later `rounded-cv-lg` / `shadow-neu` really replaces an earlier `rounded-full` / `shadow-sm`
 * (otherwise both classes survive and the stylesheet order decides, which bit the avatar tile).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ['cv-sm', 'cv-md', 'cv-lg', 'cv-xl'] }],
      shadow: [{ shadow: ['neu', 'neu-sm', 'neu-in', 'neu-in-sm', 'glass'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
