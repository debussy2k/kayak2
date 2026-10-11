// dist/m1textbox_node.d.ts (node 번들) 소비자 검증
import { textbox, GT_MasterClipboard, TB_PlatformEnv } from '../../../dist/m1textbox_node';
const tb_node = new textbox({ schema: true, masterClipboard: GT_MasterClipboard.getInstance() });
const n_node: number = tb_node.getLength();
void TB_PlatformEnv;
