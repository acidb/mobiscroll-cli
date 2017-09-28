module.exports = {
  copyAssets: {
    src: ['{{SRC}}/assets/images/*'],
    dest: '{{WWW}}/assets/images'
  },
  copyMobiscrollCss: {
    src: ['{{ROOT}}/node_modules/@mobiscroll/angular-trial/dist/css/*'],
    dest: '{{WWW}}/lib/mobiscroll/css/'
  }
}
