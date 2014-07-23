'use strict';
/*jshint unused:vars */

angular.module('RedhatAccess.cases')
.directive('rhaPageheader', function () {
  return {
    templateUrl: 'cases/views/pageHeader.html',
    restrict: 'EA',
    scope: {
      title: '=title'
    },
    link: function postLink(scope, element, attrs) {
    }
  };
});
