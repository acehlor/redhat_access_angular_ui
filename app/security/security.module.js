'use strict';
/*global strata,$*/
/*jshint unused:vars */
angular.module('RedhatAccess.security', ['ui.bootstrap', 'RedhatAccess.template', 'ui.router'])
  .constant('AUTH_EVENTS', {
    loginSuccess: 'auth-login-success',
    loginFailed: 'auth-login-failed',
    logoutSuccess: 'auth-logout-success',
    sessionTimeout: 'auth-session-timeout',
    notAuthenticated: 'auth-not-authenticated',
    notAuthorized: 'auth-not-authorized'
  })
  .directive('rhaLoginStatus', function () {
    return {
      restrict: 'AE',
      scope: false,
      templateUrl: 'security/login_status.html'
    };
  })
  .controller('SecurityController', ['$scope', '$rootScope', 'securityService', 'SECURITY_CONFIG',
    function ($scope, $rootScope, securityService, SECURITY_CONFIG) {
      $scope.securityService = securityService;
      if (SECURITY_CONFIG.autoCheckLogin) {
        securityService.validateLogin(false); //change to false to force login
      }
      $scope.displayLoginStatus = function(){
        return SECURITY_CONFIG.displayLoginStatus;

      };
    }
  ])
  .value('LOGIN_VIEW_CONFIG', {
    verbose: true,
  })
  .value('SECURITY_CONFIG', {
    displayLoginStatus: true,
    autoCheckLogin: true,
    loginURL: "",
    logoutURL: ""
  })
  .service('securityService', ['$rootScope', '$modal', 'AUTH_EVENTS', '$q', 'LOGIN_VIEW_CONFIG', 'SECURITY_CONFIG',
    function ($rootScope, $modal, AUTH_EVENTS, $q, LOGIN_VIEW_CONFIG, SECURITY_CONFIG) {

      this.loginStatus = {
        isLoggedIn: false,
        loggedInUser: '',
        verifying: false,
        isInternal: false,
        sessionId: ''
      };

      this.loginURL = SECURITY_CONFIG.loginURL;
      this.logoutURL = SECURITY_CONFIG.logoutURL;

      this.setLoginStatus = function (isLoggedIn, userName, verifying, isInternal, sessionId) {
        this.loginStatus.isLoggedIn = isLoggedIn;
        this.loginStatus.loggedInUser = userName;
        this.loginStatus.verifying = verifying;
        this.loginStatus.isInternal = isInternal;
        this.loginStatus.sessionId = sessionId;
      };

      var modalDefaults = {
        backdrop: 'static',
        keyboard: true,
        modalFade: true,
        templateUrl: 'security/login_form.html',
        windowClass: 'rha-login-modal'
      };

      var modalOptions = {
        closeButtonText: 'Close',
        actionButtonText: 'OK',
        headerText: 'Proceed?',
        bodyText: 'Perform this action?',
        backdrop: 'static'

      };

      this.getBasicAuthToken = function () {
        var defer = $q.defer();
        var token = localStorage.getItem('rhAuthToken');
        if (token !== undefined && token !== '') {
          defer.resolve(token);
          return defer.promise;
        } else {
          this.login().then(
            function (authedUser) {
              defer.resolve(localStorage.getItem('rhAuthToken'));
            },
            function (error) {
              console.log('Unable to get user credentials');
              defer.resolve(error);
            });
          return defer.promise;
        }
      };

      this.initLoginStatus = function () {
        var defer = $q.defer();
        var that = this;
        this.loginStatus.verifying = true;
        strata.checkLogin(
          function (result, authedUser) {
            if (result) {
              that.setLoginStatus(true, authedUser.name, false, authedUser.is_internal);
              defer.resolve(authedUser.name);
            } else {
              that.setLoginStatus(false, '', false, false);
              defer.reject('');
            }
          }
        );
        return defer.promise;
      };

      this.validateLogin = function (forceLogin) {
        var defer = $q.defer();
        var that = this;
        if (!forceLogin) {
          this.initLoginStatus().then(
            function (username) {
              defer.resolve(username);
            },
            function (error) {
              defer.reject(error);
            }
          );
          return defer.promise;
        } else {
          this.initLoginStatus().then(
            function (username) {
              console.log('User name is ' + username);
              defer.resolve(username);
            },
            function (error) {
              that.login().then(
                function (authedUser) {
                  defer.resolve(authedUser.name);
                },
                function (error) {
                  defer.reject(error);
                });
            }
          );
          return defer.promise;
        }
      };

      this.login = function () {
        var that = this;
        var result = this.showLogin(modalDefaults, modalOptions);
        result.then(
          function (authedUser) {
            console.log('User logged in : ' + authedUser.name);
            that.setLoginStatus(true, authedUser.name, false, authedUser.is_internal);
          },
          function (error) {
            console.log('Unable to login user');
            that.setLoginStatus(false, '', false, false);
          });
        return result; // pass on the promise
      };

      this.logout = function () {
        strata.clearCredentials();
        this.setLoginStatus(false, '', false, false);
        $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
      };

      this.getLoggedInUserName = function () {
        return strata.getAuthInfo().name;
      };

      this.showLogin = function (customModalDefaults, customModalOptions) {
        //Create temp objects to work with since we're in a singleton service
        var tempModalDefaults = {};
        var tempModalOptions = {};
        //Map angular-ui modal custom defaults to modal defaults defined in service
        angular.extend(tempModalDefaults, modalDefaults, customModalDefaults);
        //Map modal.html $scope custom properties to defaults defined in service
        angular.extend(tempModalOptions, modalOptions, customModalOptions);
        if (!tempModalDefaults.controller) {
          tempModalDefaults.controller = ['$scope', '$modalInstance',
            function ($scope, $modalInstance) {
              $scope.user = {
                user: null,
                password: null
              };
              $scope.useVerboseLoginView = LOGIN_VIEW_CONFIG.verbose;
              $scope.modalOptions = tempModalOptions;
              $scope.modalOptions.ok = function (result) {
                //Hack below is needed to handle autofill issues
                //@see https://github.com/angular/angular.js/issues/1460
                //BEGIN HACK
                $scope.user.user = $('#rha-login-user-id').val();
                $scope.user.password = $('#rha-login-password').val();
                //END HACK
                strata.setCredentials($scope.user.user, $scope.user.password,
                  function (passed, authedUser) {
                    if (passed) {
                      $rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
                      $scope.user.password = '';
                      $scope.authError = null;
                      try {
                        $modalInstance.close(authedUser);
                      } catch (err) {}
                    } else {
                      // alert("Login failed!");
                      $rootScope.$broadcast(AUTH_EVENTS.loginFailed);
                      $scope.$apply(function () {
                        $scope.authError = 'Login Failed!';
                      });
                    }
                  });

              };
              $scope.modalOptions.close = function () {
                $modalInstance.dismiss();
              };
            }
          ];
        }

        return $modal.open(tempModalDefaults).result;
      };

    }
  ]);
