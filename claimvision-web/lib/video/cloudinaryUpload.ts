/**
 * Incoming transformation applied by Cloudinary on upload (before the asset is stored).
 * Scales video to ~360p height (640×360 for 16:9), preserving aspect ratio.
 * @see https://cloudinary.com/documentation/eager_and_incoming_transformations
 */
export const CLOUDINARY_VIDEO_INCOMING_TRANSFORMATION = 'h_360,c_scale,q_auto:good';
