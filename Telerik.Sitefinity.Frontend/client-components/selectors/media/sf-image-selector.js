﻿; (function () {
    var sfSelectors = angular.module('sfSelectors');
    sfSelectors.requires.push('sfImageSelector');

    angular.module('sfImageSelector', ['sfServices', 'sfInfiniteScroll', 'sfCollection', 'sfTree', 'sfSearchBox', 'sfSortBox'])
        .directive('sfImageSelector', ['sfMediaService', 'sfMediaFilter', 'serverContext', 'serviceHelper', 'sfFlatTaxonService', 'sfHierarchicalTaxonService',
        function (sfMediaService, sfMediaFilter, serverContext, serviceHelper, sfFlatTaxonService, sfHierarchicalTaxonService) {
            var helpers = {
                getDate: function (daysToSubstract, monthsToSubstract, yearsToSubstract) {
                    var now = new Date();

                    if (daysToSubstract) {
                        now.setDate(now.getDate() - daysToSubstract);
                    }

                    if (monthsToSubstract) {
                        now.setMonth(now.getMonth() - monthsToSubstract);
                    }

                    if (yearsToSubstract) {
                        now.setYear(now.getFullYear() - yearsToSubstract);
                    }

                    return now;
                }
            };

            var constants = {
                initialLoadedItemsCount: 50,
                infiniteScrollLoadedItemsCount: 20,
                recentImagesLastDaysCount: 7,
                filters: {
                    basic: [
                        { title: 'Recent Images', value: 'recentItems' },
                        { title: 'My Images', value: 'ownItems' },
                        { title: 'All Libraries', value: 'allLibraries' }
                    ],
                    anyDateValue: 'AnyTime',
                    dates: [
                        { text: 'Any time', dateValue: 'AnyTime' },
                        { text: 'Last 1 day', dateValue: helpers.getDate(1) },
                        { text: 'Last 3 days', dateValue: helpers.getDate(3) },
                        { text: 'Last 1 week', dateValue: helpers.getDate(7) },
                        { text: 'Last 1 month', dateValue: helpers.getDate(0, 1) },
                        { text: 'Last 6 months', dateValue: helpers.getDate(0, 6) },
                        { text: 'Last 1 year', dateValue: helpers.getDate(0, 0, 1) },
                        { text: 'Last 2 years', dateValue: helpers.getDate(0, 0, 2) },
                        { text: 'Last 5 years', dateValue: helpers.getDate(0, 0, 5) }
                    ],
                    tags: {
                        pageSize: 10,
                        field: 'Tags',
                        taxonomyId: 'CB0F3A19-A211-48a7-88EC-77495C0F5374'
                    },
                    categories: {
                        pageSize: 10, // not used by the service
                        field: 'Category',
                        taxonomyId: 'E5CD6D69-1543-427B-AD62-688A99F5E7D4'
                    }
                }
            };

            return {
                restrict: 'E',
                scope: {
                    selectedItem: '=?sfModel'
                },
                templateUrl: function (elem, attrs) {
                    var assembly = attrs.sfTemplateAssembly || 'Telerik.Sitefinity.Frontend';
                    var url = attrs.sfTemplateUrl || 'client-components/selectors/media/sf-image-selector.html';
                    return serverContext.getEmbeddedResourceUrl(assembly, url);
                },
                link: function (scope, element, attrs, ctrl) {
                    var filtersLogic = {
                        // Library filter
                        loadLibraryChildren: function (parent) {
                            parent = parent || {};
                            return sfMediaService.images.getFolders({ parent: parent.Id }).then(function (response) {
                                if (response) {
                                    return response.Items;
                                }
                            });
                        },
                        // Category filter
                        getCategoryChildTaxons: function (parentId) {
                            return sfHierarchicalTaxonService.getChildTaxons(parentId, scope.query)
                                .then(function (data) {
                                    return data.Items;
                                });
                        },
                        getCategoryTaxons: function () {
                            var skip = 0;
                            return sfHierarchicalTaxonService.getTaxons(constants.filters.categories.taxonomyId, skip, constants.filters.categories.pageSize, scope.filters.category.query)
                                .then(function (data) {
                                    return data.Items;
                                });
                        },
                        loadCategoryChildren: function (parent) {
                            if (parent) {
                                return filtersLogic.getCategoryChildTaxons(parent.Id);
                            }
                            else {
                                return filtersLogic.getCategoryTaxons();
                            }
                        },
                        // Tag filter
                        loadTagTaxons: function (append) {
                            if (scope.filters.tag.isLoading) {
                                return;
                            }

                            scope.filters.tag.isLoading = true;
                            var skip = append ? scope.filters.tag.all.length : 0;
                            sfFlatTaxonService.getTaxons(constants.filters.tags.taxonomyId, skip, constants.filters.tags.pageSize, scope.filters.tag.query)
                                .then(function (data) {
                                    if (data && data.Items) {
                                        if (append) {
                                            if (scope.filters.tag.all && scope.filters.tag.all.length === skip) {
                                                scope.filters.tag.all = scope.filters.tag.all.concat(data.Items);
                                            }
                                        }
                                        else {
                                            scope.filters.tag.all = data.Items;
                                        }
                                    }
                                })
                                .finally(function () {
                                    scope.filters.tag.isLoading = false;
                                });
                        },
                        loadMoreTags: function () {
                            filtersLogic.loadTagTaxons(true);
                        }
                    };

                    scope.onBreadcrumbItemClick = function (item) {
                        var filter = sfMediaFilter.newFilter();
                        filter.set.parent.to(item && item.Id ? item.Id : filter.parent);
                        scope.sortExpression = null;
                        scope.filterObject = filter;
                    };

                    var refresh = function (appendItems) {
                        if (scope.isLoading) {
                            return;
                        }

                        scope.breadcrumbs = [];

                        var options = {
                            filter: scope.filterObject.composeExpression(),
                            parent: scope.filterObject.parent,
                            sort: scope.sortExpression
                        };

                        if (appendItems) {
                            options.skip = scope.items.length;
                            options.take = constants.infiniteScrollLoadedItemsCount;
                        }
                        else {
                            options.take = constants.initialLoadedItemsCount;
                        }

                        if (scope.isLoading === false) {
                            scope.isLoading = true;

                            var itemsLength = scope.items ? scope.items.length : 0;
                            sfMediaService.images.get(options, scope.filterObject, appendItems)
                                .then(function (response) {
                                    if (response && response.Items) {
                                        if (appendItems) {
                                            if (scope.items && scope.items.length === itemsLength) {
                                                scope.items = scope.items.concat(response.Items);
                                            }
                                        }
                                        else {
                                            scope.items = response.Items;
                                        }
                                    }
                                })
                                .finally(function () {
                                    scope.isLoading = false;
                                });
                        }
                    };

                    scope.filterObject = sfMediaFilter.newFilter();
                    scope.sortExpression = null;
                    scope.items = [];
                    scope.isLoading = false;
                    scope.showSortingAndView = false;

                    scope.filters = {
                        basic: {
                            all: constants.filters.basic,
                            selected: null,
                            select: function (basicFilter) {
                                scope.filters.basic.selected = basicFilter;
                                scope.filterObject.set.basic[basicFilter]();

                                scope.filters.library.selected = [];
                                scope.filters.date.selected = [];
                                scope.filters.tag.selected = [];
                                scope.filters.category.selected = [];
                            },
                        },
                        library: {
                            selected: [],
                            getChildren: filtersLogic.loadLibraryChildren
                        },
                        date: {
                            all: constants.filters.dates,
                            selected: []
                        },
                        tag: {
                            all: [],
                            selected: [],
                            query: null,
                            isLoading: false,
                            loadMore: filtersLogic.loadMoreTags
                        },
                        category: {
                            filtered: [],
                            selected: [],
                            query: null,
                            getChildren: filtersLogic.loadCategoryChildren
                        }
                    };

                    scope.narrowResults = scope.filterObject.set.query.to;

                    // load more images
                    scope.loadMore = function () {
                        refresh(true);
                    };

                    /*
                    * Watches.
                    */

                    scope.$watch('sortExpression', function (newVal, oldVal) {
                        if (newVal !== oldVal) {
                            if (newVal !== scope.filterObject.constants.dateCreatedDescending && scope.filterObject.basic === scope.filterObject.constants.basic.recentItems) {
                                scope.filterObjects.set.basic.none();
                                scope.filters.basic.selected = null;
                            }
                            else {
                                refresh();
                            }
                        }
                    });

                    scope.$watchCollection('filters.library.selected', function (newVal, oldVal) {
                        if (newVal !== oldVal && newVal && newVal[0]) {
                            scope.filters.basic.selected = null;
                            scope.filterObject.set.parent.to(newVal[0]);
                        }
                    });

                    scope.$watchCollection('filters.tag.selected', function (newVal, oldVal) {
                        if (newVal !== oldVal && newVal && newVal[0]) {
                            scope.filters.basic.selected = null;
                            scope.filterObject.set.taxon.to(newVal[0], constants.filters.tags.field);
                        }
                    });

                    scope.$watch('filters.tag.query', function (newVal, oldVal) {
                        if (newVal !== oldVal) {
                            filtersLogic.loadTagTaxons(false);
                        }
                    });

                    scope.$watchCollection('filters.category.selected', function (newVal, oldVal) {
                        if (newVal !== oldVal && newVal && newVal[0]) {
                            scope.filters.basic.selected = null;
                            scope.filterObject.set.taxon.to(newVal[0], constants.filters.categories.field);
                        }
                    });

                    scope.$watch('filters.category.query', function (newVal, oldVal) {
                        if (newVal !== oldVal) {
                            filtersLogic.getCategoryTaxons().then(function (items) {
                                scope.filters.category.filtered = items;
                            });
                        }
                    });

                    scope.$watchCollection('filters.date.selected', function (newVal, oldVal) {
                        if (newVal !== oldVal && newVal[0]) {
                            scope.filters.basic.selected = null;
                            if (newVal[0] === constants.filters.anyDateValue) {
                                scope.filterObject.set.date.all();
                            }
                            else {
                                scope.filterObject.set.date.to(newVal[0]);
                            }
                        }
                    });

                    // Reacts when a folder is clicked.
                    scope.$on('sf-collection-item-selected', function (event, data) {
                        if (data && data.IsFolder === true) {
                            scope.filters.basic.selected = null;
                            scope.filterObject.set.parent.to(data.Id);
                        }
                    });

                    /*
                    * Initialization.
                    */

                    (function initializeWindow() {
                        // initial open populates dialog with all root libraries
                        scope.filterObject.set.basic.allLibraries();

                        // initial filter dropdown option
                        scope.selectedFilterOption = 1;

                        filtersLogic.loadTagTaxons(false);

                        scope.filterObject.attachEvent(refresh);
                    }());
                }
            };
        }]);
})();