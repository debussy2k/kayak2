import type { ISegAttr } from './types';

class GT_SegRange {
    m_SegVec: ISegAttr[] = []; // array of GT_Segment

    // segment의 시작, 끝 인덱스를 나타냄.
    // 아래 두 변수는 undo/redo에서만 사용함.
    m_nFirstSegIndex = -1;
    m_nLastSegIndex = -1;

    // GT_SegmentLayer_Par에만 사용됨.
    // whole segment : segment에 $가 포함되면 true
    m_first_whole_seg = true;
    m_last_whole_seg = true;

    clear(): void {
        this.m_nFirstSegIndex = this.m_nLastSegIndex = -1;
        this.m_first_whole_seg = true;
        this.m_last_whole_seg = true;
        this.m_SegVec.length = 0;
    }

    clone(): GT_SegRange {
        var SegRng = new GT_SegRange;
        SegRng.m_nFirstSegIndex = this.m_nFirstSegIndex;
        SegRng.m_nLastSegIndex = this.m_nLastSegIndex;
        SegRng.m_first_whole_seg = this.m_first_whole_seg;
        SegRng.m_last_whole_seg = this.m_last_whole_seg;

        for (var i = 0; i < this.m_SegVec.length; i++)
            SegRng.m_SegVec.push(this.m_SegVec[i].clone());

        return SegRng;
    }

    copy(pSrc: GT_SegRange): void {
        this.clear();

        this.m_nFirstSegIndex = pSrc.m_nFirstSegIndex;
        this.m_nLastSegIndex = pSrc.m_nLastSegIndex;
        this.m_first_whole_seg = pSrc.m_first_whole_seg;
        this.m_last_whole_seg = pSrc.m_last_whole_seg;

        for (var i = 0; i < pSrc.m_SegVec.length; i++)
            this.m_SegVec.push(pSrc.m_SegVec[i].clone());
    }

    get_element_count(): number {
        var count = 0;
        for (var i = 0; i < this.m_SegVec.length; i++)
            count += this.m_SegVec[i].m_nCount;
        return count;
    }

    make_from_string(str: ArrayLike<number>, default_attr: ISegAttr): void {
        this.clear();

        var count = 0,
            count_of_return = 0;
        var str_size = str.length;
        for (var i = 0; i < str_size; i++) {
            ++count;
            count_of_return += (str[i] == 10) ? 1 : 0;
            if (str[i] == 10 || i == str_size - 1) {
                var seg = default_attr.clone();
                seg.m_nCount = count;
                this.m_SegVec.push(seg);
                count = 0;
            }
        }
        this.m_first_whole_seg = (count_of_return > 0) ? true : false;
        this.m_last_whole_seg = (str[str_size - 1] == 10) ? true : false;
    }
}

export default GT_SegRange;
