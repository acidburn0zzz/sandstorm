// Sandstorm - Personal Cloud Sandbox
// Copyright (c) 2015 Sandstorm Development Group, Inc. and contributors
// All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var Crypto = Npm.require("crypto");

var globalDb = new SandstormDb();
// TODO(cleanup): Use a lightweight fake (minimongo-based?) database here and construct a clean
// instance at the start of each test case.

globalDb.collections.packages.remove({});
globalDb.collections.appIndex.remove({});
globalDb.collections.userActions.remove({});
globalDb.collections.notifications.remove({});
Meteor.users.remove({});
// Note that `meteor test-packages` starts with a fresh Mongo instance. That instance, however,
// does not automatically get cleared on hot code reload.

globalDb.collections.settings.upsert({_id: "appMarketUrl"},
                                     {$set: {value: "https://apps.sandstorm.io"}});
globalDb.collections.settings.upsert({_id: "appIndexUrl"},
                                     {$set: {value: "https://app-index.sandstorm.io"}});
globalDb.collections.settings.upsert({_id: "appUpdatesEnabled"},
                                     {$set: {value: true}});

var aliceUserId = Accounts.insertUserDoc({profile: {name: "Alice"},
                                          service: {dev: {name: "alice" + Crypto.randomBytes(10).toString("hex")}}},
                                         {});
var bobUserId = Accounts.insertUserDoc({profile: {name: "Bob"},
                                        service: {dev: {name: "Bob" + Crypto.randomBytes(10).toString("hex")}}},
                                       {});

var packageV0 = { _id: "mock-package-id1",
  status: "ready",
  progress: 1,
  isAutoUpdated: false,
  error: null,
  manifest:
   { minApiVersion: 0,
     maxApiVersion: 0,
     appMarketingVersion: { defaultText: "0.1" },
     appTitle: { defaultText: "Mock App" },
     actions: [{
       input: { none: null },
       title: { defaultText: "New Mock App" } }],
     appVersion: 0,
     minUpgradableAppVersion: 0 },
  appId: "mock-app-id",
};

var packageV1 = { _id: "mock-package-id2",
  status: "ready",
  progress: 1,
  isAutoUpdated: false,
  error: null,
  manifest:
   { minApiVersion: 0,
     maxApiVersion: 0,
     appMarketingVersion: { defaultText: "0.2" },
     appTitle: { defaultText: "Mock App" },
     actions: [{title: { defaultText: "New Mock App" } }],
     appVersion: 2,
     minUpgradableAppVersion: 0 },
  appId: "mock-app-id",
};

globalDb.collections.packages.insert(packageV0);
globalDb.collections.packages.insert(packageV1);

function stubUser(test, userId) {
  test.stub(Meteor, "userId", function() {
    return userId;
  });
}

Tinytest.add("test update notifications", sinon.test(function (test) {
  globalDb.collections.appIndex.remove({});
  globalDb.collections.userActions.remove({});
  globalDb.collections.notifications.remove({});

  this.stub(Meteor, "call", function() {});
  stubUser(this, aliceUserId);
  this.stub(HTTP, "get", function () {
    return {data: { apps: [{
      appId: "mock-app-id",
      versionNumber: 1,
      version: "0.2",
      packageId: "mock-package-id2",
      name: "Mock App",
    }]}};
  });

  globalDb.addUserActions("mock-package-id1");

  SandstormAutoupdateApps.updateAppIndex(globalDb);
  var notification = globalDb.collections.notifications.findOne();
  var appUpdate = notification.appUpdates["mock-app-id"];
  test.isNotNull(appUpdate);
  test.equal(appUpdate.name, "Mock App");
  test.equal(appUpdate.marketingVersion, "0.2");
}));
