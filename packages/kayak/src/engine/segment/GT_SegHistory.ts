import type { SegHistoryInfo } from './types';

class GT_SegHistory {
    private vec: SegHistoryInfo[] = []; // array of GT_SegHistoryInfo
    private m_nPointer = -1;
    private m_nLimit = 0; // 보관할 최대 항목 수. 0이면 무제한(기본값).

    reset(): void {
        this.vec.length = 0;
        this.m_nPointer = -1;
    }

    set_history_limit(limit: number): void {
        this.m_nLimit = (limit > 0) ? limit : 0;
        this.trim_to_limit();
    }

    push_shi(SegHistoryInfo: SegHistoryInfo): void {
        this.vec.splice(this.m_nPointer + 1);
        this.vec.push(SegHistoryInfo);
        this.m_nPointer += 1;
        this.trim_to_limit();
    }

    // 상한을 넘으면 가장 오래된 항목부터 버린다.
    private trim_to_limit(): void {
        if (this.m_nLimit > 0 && this.vec.length > this.m_nLimit) {
            var nRemove = this.vec.length - this.m_nLimit;
            this.vec.splice(0, nRemove);
            this.m_nPointer = Math.max(this.m_nPointer - nRemove, -1);
        }
    }

    getPrevStep(): SegHistoryInfo | null {
        if (this.m_nPointer === -1)
            return null;

        var pSegHistoryInfo = this.vec[this.m_nPointer];
        --this.m_nPointer;
        return pSegHistoryInfo;
    }

    getNextStep(): SegHistoryInfo | null {
        if (this.m_nPointer + 1 >= this.vec.length) {
            // alert("getNextStep() failed")
            return null;
        }

        ++this.m_nPointer;
        return this.vec[this.m_nPointer];
    }

    getLastStep(): SegHistoryInfo | null {
        if (this.m_nPointer === -1)
            return null;
        return this.vec[this.m_nPointer];
    }

    getPointer(): number {
        return this.m_nPointer;
    }

    log(): void {
        console.log('vec: ', this.vec);
    }
}

export default GT_SegHistory;
