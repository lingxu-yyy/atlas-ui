# REVIEW
每条三行：曾说 / 实际 / 以后怎么防。

## 1. 按需引入 <3KB
曾说：按需引入 <3KB
实际：单入口全量产物、CSS 不可摇树
以后怎么防：只写实测口径

## 2. 阶段1"已完成"
曾说：阶段1"已完成"
实际：只是文件存在
以后怎么防：验收必须可执行

## 3. 跨页脏行丢失
曾说：跨页脏行丢失
实际：只遍历 props.data
以后怎么防：状态以 drafts 为源

## 4. 异步 validator 被当通过
曾说：异步 validator 被当通过
实际：只判 typeof string
以后怎么防：Promise 必须 await

## 5. blob URL 只回收压缩路径
曾说：blob URL 只回收压缩路径
实际：删除与卸载泄漏
以后怎么防：统一走 releaseUrl
