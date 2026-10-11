import type TP_TextRange from './TP_TextRange';

class TP_TextHistoryInfo {
	m_pRngBefore: TP_TextRange | null;
	m_pRngAfter: TP_TextRange | null;
	m_noop: boolean;

	constructor() {
		this.m_pRngBefore = null;
		this.m_pRngAfter = null;
		this.m_noop = false;
	}
}

export default TP_TextHistoryInfo;
