# 设计文档索引

本索引面向设计、开发和测试协作者。文档描述预期玩法，供设计确认和后续实现使用；该语句反映原设计快照时点。本仓库的可运行实现、测试参数与未实现边界见[像素切片 0.2](pixel-slice.md)。

## 建议阅读顺序

1. 阅读[设计总览](overview.md)，了解核心循环。
2. 阅读[外出与生存](modules/expedition-survival.md)和[网格库存](modules/grid-inventory.md)。
3. 阅读[基地生产](modules/production.md)和[时间与世界](modules/time-world.md)。
4. 阅读[成长与后续方向](modules/progression-future.md)，确认当前规则与扩展设想的边界。
5. 查阅[设计决定](decisions.md)和[待确认问题](open-questions.md)。

## 模块边界

| 文档 | 负责说明 | 主要关联 |
| --- | --- | --- |
| [设计总览](overview.md) | 产品方向、核心循环、参考范围和实现状态 | 全部模块 |
| [外出与生存](modules/expedition-survival.md) | 外出流程、失败损失、角色状态与补给 | 库存、时间、生产 |
| [网格库存](modules/grid-inventory.md) | 物品占格、拾取、装备替换、换包和回仓 | 外出、生产 |
| [基地生产](modules/production.md) | 配方、热量、燃料槽和机器存储 | 库存、时间 |
| [时间与世界](modules/time-world.md) | 普通时钟、真时、地图和昼夜 | 全部时间相关系统 |
| [成长与后续方向](modules/progression-future.md) | 增量升级与未确定制作范围的扩展 | 外出、库存、世界 |
| [设计决定](decisions.md) | 当前有效规则与被替代方案 | 各模块正文 |
| [待确认问题](open-questions.md) | 缺失参数、系统交互和范围决定 | 各模块正文 |
| [项目词汇表](glossary.md) | 名称、定义及易混概念 | 全部文档 |
| [文档约定](documentation.md) | 状态标记、更新流程与写作要求 | 文档维护 |

## 使用边界

“已确认”只说明设计决定的状态。实现状态必须另行记录，不能用设计文档推定功能已完成。

本次文档没有批准具体架构、任务排期或首版内容数量。待确认项在解决前，不得改写成默认值或实现承诺。

[返回仓库首页](../README.md)
