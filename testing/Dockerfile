FROM node:22-alpine
# Alpine's own Chromium (musl): Puppeteer's bundled download is linked against glibc and will not run here.
RUN apk add --no-cache chromium
