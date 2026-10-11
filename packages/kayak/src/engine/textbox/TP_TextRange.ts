
class TP_TextRange {
	m_text: number[];
	m_cursor_pos: number;
	m_begin: number;
	m_end: number;

	constructor() {
		this.m_text = [];
		this.m_cursor_pos = -1;
		this.m_begin = -1;
		this.m_end = -1;
	}

	clear(): void {
		this.m_begin = this.m_end = -1;
		this.m_text = [];
	}

	clone(): TP_TextRange {
		var clone = new TP_TextRange;
		clone.m_begin = this.m_begin;
		clone.m_end = this.m_end;
		clone.m_cursor_pos = this.m_cursor_pos;
		clone.m_text =  this.m_text.slice(0);

		return clone;
	}

	length(): number {
		return this.m_end - this.m_begin;
	}
}

export default TP_TextRange;
