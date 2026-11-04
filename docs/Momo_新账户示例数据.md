# Momo 新账户示例数据

Momo 为白色雌性萨摩耶的虚构体验档案，包含连续7天、50条活动记录和51张不同照片（50张活动图＋1张头像）。所有图片由AI生成，记录与图片均在内容中标注为Demo。

## 已上线的行为

启用时间：2026-11-05 03:12:31（Asia/Singapore）。此后注册的新用户，首次通过现有CloudRoot流程创建personal_workspaces时，数据库before-insert trigger把空占位宠物替换为Momo。

- 每个账户获得自己的JSON副本、作者ID和主照护者身份；后续编辑与其他账户隔离。
- 日期以首次初始化当天为基准，平移到昨天结束的7个完整自然日；之后重登不再平移或重置。
- 出生日期不平移；11/03情境中的午后休息仍为null，不补造休息记录。
- 已有workspace不回填；启用前注册但尚未初始化的账户也不回填；用户自己创建的宠物不会被替换。
- 初始化保持insert-only/on-conflict-do-nothing，重复登录和并发初始化不重复添加。
- 当前App的时间线以savedAt展示事件时间，因此数据库副本把observedAt放入savedAt，原记录写入时间另存recordedAt。素材包原始数据未更改。
- setupStatus设为completed，使用户直接进入Momo体验；原有界面指引仍可显示。Guest Luna体验保持不变。

## 文件与存储

- fixtures/momo-demo-week.json：已发布图片URL与完整模板，是本次模板的版本化源文件。
- supabase/migrations/20261104191231_momo_new_account_demo.sql：私有模板表、日期平移函数、首次workspace插入触发器。
- scripts/momo-template-sql.mjs：输出幂等模板安装SQL，不读取凭据，也不修改客户数据。先发布素材、校验后再由项目管理连接执行输出的SQL。
- supabase/tests/momo_new_account_demo.sql：在事务内验证新用户、旧用户、重试、用户自建宠物、日期与权限；全部回滚，包括临时Auth用户。
- tests/momoDemo.test.mjs：验证50张活动图的唯一性、标注、每日合计和缺失值。

图片存于公开的pawsona-demo桶/momo-v2/，只放虚构示意图片。51张已上传文件与本地SHA256逐个匹配。没有开放客户端INSERT/UPDATE/DELETE策略；发布时的单一测试身份临时INSERT策略已经移除。原有私人pawsona-media桶及其权限保持原样。

模板存于pawsona_private.demo_pet_templates，启用RLS并撤销PUBLIC、anon、authenticated访问；没有客户端策略是有意设计。触发函数位于私有schema、固定search_path，并撤销客户端EXECUTE权限。现有workspace会话检查与RLS继续生效。

## 验收与停用

已用两个实际注册账户验证：首次登录50条记录/50张不同活动图/7天；重复登录与初始化重试不改动数据；账户之间无法读取对方workspace；普通用户不能上传或改写示例素材。

需要停止后续新账户自动填充时，可通过管理连接执行：

```sql
update pawsona_private.demo_pet_templates
set enabled=false where id='momo-seven-days-20261105-v1';
```

停用只影响之后的首次初始化，不删除已复制到任何账户的数据。更新素材时使用新版本路径与模板ID，避免改写用户正在使用的图片。

## 本次检查结果

数据库事务测试、两个真实新账户的API验收、Momo数据单测2项、TypeScript检查和生产构建均通过。原有全量75项测试中74项通过，careTasks的“completion can be undone and checked again…”权限断言失败；本次没有修改该功能或其测试。数据库Advisor未增加WARN级别问题；私有模板表的“RLS无策略”INFO是上述拒绝客户端访问的预期配置。
