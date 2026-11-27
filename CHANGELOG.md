# Changelog

## [1.17.1](https://github.com/zuugle-services/DianaWidget/compare/v1.17.0...v1.17.1) (2026-11-27)


### Documentation

* document the Bunny CDN hosting, caching and landing page ([#147](https://github.com/zuugle-services/DianaWidget/issues/147)) ([84f2979](https://github.com/zuugle-services/DianaWidget/commit/84f2979a73c775e66e1d4fa06d44e01aaadc9a1a))

## [1.17.0](https://github.com/zuugle-services/DianaWidget/compare/v1.16.0...v1.17.0) (2026-11-27)


### Features

* A-to-B journey mode for plain point-to-point connection search ([#141](https://github.com/zuugle-services/DianaWidget/issues/141)) ([1f4525b](https://github.com/zuugle-services/DianaWidget/commit/1f4525b8f4f8add55a730974c9804b99d6ac2423))
* maxWidth and maxHeight options to let the widget use the full container width ([d6a71ba](https://github.com/zuugle-services/DianaWidget/commit/d6a71ba2702c2e2695f6e0bb647f475e81fa9d69))
* per-date time windows for dateList, schema.org openingHours and optional hiding when no future date is left ([#138](https://github.com/zuugle-services/DianaWidget/issues/138)) ([46106f5](https://github.com/zuugle-services/DianaWidget/commit/46106f5b272daa5cadcd9b9b145bdb519d172841))


### Bug Fixes

* empty openingHours or dateList no longer turns into a configuration error ([#142](https://github.com/zuugle-services/DianaWidget/issues/142)) ([90013ce](https://github.com/zuugle-services/DianaWidget/commit/90013ce74b991ae779b4d676b94d277fe28a520f))

## [1.16.0](https://github.com/zuugle-services/DianaWidget/compare/v1.15.0...v1.16.0) (2026-11-20)


### Features

* "change departure point" dialog for shared journeys ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* add showTicketShopButtons option to render no ticket shop buttons ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* auto-dismissing notice for newly added on-demand connections ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* direct ticket links for segments that have their own ticket URL ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* loading skeleton and location icons for shared journey results ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* new connection box design and icons ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* new DateField date selection replacing the range and single calendars ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* optional earlier/later connection buttons in the slider ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* show alerts, booking requirements and on-demand details per leg ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* show past connections and real-time delays and platform changes ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))


### Bug Fixes

* clearer messages for expired bookings ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* enforce the light color scheme and keep input fields legible ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* singular label for a single transfer ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))


### Refactoring

* activity name is optional in the configuration ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))
* drop booking rule fields DianaProxy no longer returns ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))


### Documentation

* README is now a quick start, full reference in docs/DOCUMENTATION.md ([b9045a8](https://github.com/zuugle-services/DianaWidget/commit/b9045a8344f3eb7bde41bd3e472212ee59926eea))

## Changelog

Maintained by release-please from the conventional-commit PR titles; don't edit by hand.
Releases up to 1.15.0: see [GitHub Releases](https://github.com/zuugle-services/DianaWidget/releases).
