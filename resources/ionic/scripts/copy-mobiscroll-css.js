module.exports = {
  copyAssets: {
    src: ['{{SRC}}/assets/images/*'],
    dest: '{{WWW}}/assets/images'
  },
  copyMobiscrollCss: {
    src: ['{{ROOT}}/src/lib/mobiscroll/css/*'],
    dest: '{{WWW}}/lib/mobiscroll/css/'
  }
}