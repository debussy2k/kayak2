import type TP_TextHistoryInfo from './TP_TextHistoryInfo';

class TP_TextHistory {
	private vec: TP_TextHistoryInfo[];
	private m_nPointer: number;

	constructor() {
		this.vec = [];
		this.m_nPointer = -1;
	}

	push_thi(HistoryInfo: TP_TextHistoryInfo): void {
		this.vec.splice(this.m_nPointer+1, this.vec.length-(this.m_nPointer+1), HistoryInfo);
		this.m_nPointer += 1;
	}

	getPrevStep(): TP_TextHistoryInfo | null {
		if (this.m_nPointer == -1)
			return null;
		var prev_index = this.m_nPointer;
		--this.m_nPointer;
		return this.vec[prev_index];
	}

	getNextStep(): TP_TextHistoryInfo | null {
		if (this.vec.length === 0 || this.m_nPointer === (this.vec.length-1))
			return null;

		++this.m_nPointer;
		return this.vec[this.m_nPointer];
	}
	getLastStep(): TP_TextHistoryInfo | null {
		if (this.m_nPointer === -1)
			return null;
		return this.vec[this.m_nPointer];
	}
}

export default TP_TextHistory;
