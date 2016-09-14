'use strict';

export default class AdvancedCaseSearchService {
    constructor(strataService) {
        'ngInject';

        this.searching = false;
        this.cases = [];
        this.query = null;
        this.order = null;

        this.pageSize = 20;
        this.currentPage = 0;
        this.totalCases = null;

        // For displaying where we are at in the pagination
        this.getCasesStart = () => {
            return this.currentPage * this.pageSize;
        };

        this.getCasesEnd = () => {
            const end = (this.currentPage * this.pageSize) + this.pageSize;
            if (end > this.totalCases) {
                return this.totalCases;
            }
            return end;
        };

        this.performSearch = (query, order) => {
            var solrOrder = this.resolveOrder(order);
            if (query == null || this.searching) return;
            if (this.query !== query || this.order !== solrOrder) {
                this.cases = [];
                this.totalCases = null;
                this.currentPage = 0;
            }
            this.searching = true;
            this.query = query;
            this.order = solrOrder;
            return strataService.cases.advancedSearch(query, solrOrder, this.getCasesStart(), this.pageSize).then((response) => {
                this.searching = false;
                if (response['case'] === undefined) {
                    this.totalCases = 0;
                } else {
                    this.totalCases = response.total_count;

                    // If the next page of cases requested is greater than the current cases length then we need to
                    // add those to the cases as they are new.  Otherwise we are just using cache
                    if (this.getCasesStart() + this.pageSize > this.cases.length) {
                        Array.prototype.push.apply(this.cases, response['case']);
                    }
                }
            });
        };

        this.resolveOrder = (selectedOrder) => {
            if (selectedOrder == null) return 'case_lastModifiedDate DESC';
            return 'case_' + selectedOrder.sortField + ' ' + selectedOrder.sortOrder;

        }
    }
}