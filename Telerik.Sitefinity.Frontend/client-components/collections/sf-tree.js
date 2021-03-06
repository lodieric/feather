﻿; (function ($) {
    angular.module('sfTree', ['sfServices'])
        .directive('sfTree', ['serverContext', '$q', function (serverContext, $q) {
            var TreeNode = function (item) {
                this.item = item;
                this.children = null;
                this.collapsed = true;
            };

            return {
                restrict: 'AE',
                scope: {
                    selectedItemIds: '=?sfModel',
                    sfMultiselect: '@',
                    sfIdentifier: '@',
                    sfHasChildrenField: '@',
                    sfExpandOnSelect: '@',
                    sfItemTemplateUrl: '@',
                    sfItemTemplateAssembly: '@',
                    sfDeselectable: '@',
                    sfRequestChildren: '&'
                },
                templateUrl: function (elem, attrs) {
                    var assembly = attrs.sfTemplateAssembly || 'Telerik.Sitefinity.Frontend';
                    var url = attrs.sfTemplateUrl || 'client-components/collections/sf-tree.html';
                    return serverContext.getEmbeddedResourceUrl(assembly, url);
                },
                link: function (scope, element, attrs, ctrl) {
                    var itemAssembly = scope.sfItemTemplateAssembly || 'Telerik.Sitefinity.Frontend';
                    var itemUrl = scope.sfItemTemplateUrl || 'client-components/collections/sf-tree-item.html';
                    scope.itemTemplateUrl = serverContext.getEmbeddedResourceUrl(itemAssembly, itemUrl);

                    scope.sfIdentifier = scope.sfIdentifier || 'Id';
                    scope.selectedItemIds = scope.selectedItemIds || [];
                    scope.hierarchy = {};

                    // In case no function for getting children is provided, a default one returning empty array is provided.
                    scope.sfRequestChildren = scope.sfRequestChildren || function () { var r = $q.defer(); r.resolve([]); return r.$promise; };

                    scope.hasChildren = function (node) {
                        node = node || {};

                        var result = false;

                        if (scope.sfHasChildrenField === undefined) {
                            result = JSON.stringify({}) !== JSON.stringify(node.children);
                        }
                        else {
                            result = node.item[scope.sfHasChildrenField] === true;
                        }

                        return result;
                    };

                    scope.isSelected = function (node) {
                        if (scope.selectedItemIds === undefined) {
                            return false;
                        }

                        return scope.selectedItemIds.indexOf(node.item[scope.sfIdentifier]) >= 0;
                    };

                    scope.select = function (node) {
                        if (scope.selectedItemIds === undefined) {
                            return;
                        }

                        var multiselect = scope.sfMultiselect !== undefined && scope.sfMultiselect.toLowerCase() !== 'false';
                        var deselectable = scope.sfDeselectable !== undefined && scope.sfDeselectable.toLowerCase() !== 'false';

                        var itemIndex = scope.selectedItemIds.indexOf(node.item[scope.sfIdentifier]);

                        if (!multiselect) {
                            if (itemIndex < 0) {
                                scope.selectedItemIds = [node.item[scope.sfIdentifier]];
                            }
                            else if (deselectable) {
                                // item is deselected
                                scope.selectedItemIds = [];
                            }
                        }
                        else {
                            if (itemIndex < 0) {
                                scope.selectedItemIds.push(node.item[scope.sfIdentifier]);
                            }
                            else if (deselectable) {
                                // item is deselected
                                scope.selectedItemIds.splice(itemIndex, 1);
                            }
                        }

                        if (scope.sfExpandOnSelect !== undefined) {
                            scope.toggle(node);
                        }

                        scope.$emit('sf-tree-item-selected', node.item);
                    };

                    scope.toggle = function (parentNode) {
                        if (!parentNode || JSON.stringify(parentNode.children) === JSON.stringify({})) {
                            return;
                        }

                        // no requests yet
                        if (parentNode.children === null) {
                            scope.sfRequestChildren({ parent: parentNode.item }).then(function (items) {
                                if (items && items instanceof Array) {
                                    parentNode.children = parentNode.children || {};

                                    // Item must remain expanded if it has no children
                                    if (items.length === 0) {
                                        parentNode.collapsed = false;
                                    }
                                    else {
                                        items.forEach(function (item) {
                                            parentNode.children[item[scope.sfIdentifier]] = new TreeNode(item);
                                        });
                                    }
                                }
                            });
                        }

                        parentNode.collapsed = !parentNode.collapsed;
                    };

                    // Initial load of root elements
                    scope.sfRequestChildren({ parent: null }).then(function (items) {
                        if (items && items instanceof Array) {
                            items.forEach(function (item) {
                                scope.hierarchy[item[scope.sfIdentifier]] = new TreeNode(item);
                            });
                        }
                    });
                }
            };
        }]);
})(jQuery);