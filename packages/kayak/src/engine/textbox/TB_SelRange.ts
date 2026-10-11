
class TB_SelRange {
    tbinput: any;
    m_org_pos: number;
    m_from: number;
    m_to: number;
    m_bEmpty: boolean;

    constructor(tbinput: any) {
        this.tbinput = tbinput;
        this.m_org_pos = 0;
        this.m_from = 0;
        this.m_to = 0;
        this.m_bEmpty = true;
    }

    reset(): void {
        this.m_bEmpty = true;
        this.m_org_pos = 0;
        this.m_from = 0;
        this.m_to = 0;
    }
    is_empty(): boolean {
        return this.m_bEmpty;
    }

    length(): number {
        if (this.m_bEmpty)
            return 0;
        return this.m_to - this.m_from;
    }

    set(pos1: number, pos2: number): boolean {
        if (pos1 != pos2) {
            this.m_from = Math.min(pos1, pos2);
            this.m_to = Math.max(pos1, pos2);
            this.m_bEmpty = false;

            return true;
        }
        return false;
    }

    setFrom(pos: number): boolean {
        this.m_bEmpty = true;
        this.m_from = pos;
        this.m_to = pos;
        this.m_org_pos = pos;
        return true;
    }

    setTo(pos: number): boolean {
        var bOK = true;

        if (this.m_org_pos < pos) {
            this.m_from = this.m_org_pos;
            this.m_to = pos;
            this.m_bEmpty = false;
        } else if (this.m_org_pos == pos) {
            this.m_to = pos;
            this.m_bEmpty = true;
            bOK = false;
        } else {
            this.m_from = pos;
            this.m_to = this.m_org_pos;
            this.m_bEmpty = false;
        }

        return bOK;
    }

    inRange(pos: number): boolean {
        if (this.is_empty())
            return false;

        if (this.m_from <= pos && pos < this.m_to)
            return true;
        return false;
    }
}

export default TB_SelRange;
