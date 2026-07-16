"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageSizeLimitError = exports.formatImageSize = exports.isImageOverSizeLimit = exports.MAX_IMAGE_SIZE_LABEL = exports.MAX_IMAGE_BYTES = void 0;
/** Maximum allowed image upload size (2 MB). */
exports.MAX_IMAGE_BYTES = 2 * 1024 * 1024;
exports.MAX_IMAGE_SIZE_LABEL = '2 MB';
function isImageOverSizeLimit(bytes) {
    return bytes > exports.MAX_IMAGE_BYTES;
}
exports.isImageOverSizeLimit = isImageOverSizeLimit;
function formatImageSize(bytes) {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
}
exports.formatImageSize = formatImageSize;
function imageSizeLimitError(fileLabel, bytes) {
    return `Image "${fileLabel}" is ${formatImageSize(bytes)} — maximum allowed size is ${exports.MAX_IMAGE_SIZE_LABEL}.`;
}
exports.imageSizeLimitError = imageSizeLimitError;
