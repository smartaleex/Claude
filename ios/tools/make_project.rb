#!/usr/bin/env ruby
# Builds ios/AlexHQ.xcodeproj. The generated project is committed, so you only
# need to run this if you add or rename a Swift file:
#
#     gem install --user-install xcodeproj
#     ruby ios/tools/make_project.rb
#
# One app target (AlexHQ) and one widget extension (AlexHQWidgets). The web
# app is not copied: the project points at ../index.html and ../assets, so
# the iPhone app always ships exactly what is in the repo.

require 'xcodeproj'
require 'fileutils'

IOS          = File.expand_path('..', __dir__)
PROJECT_PATH = File.join(IOS, 'AlexHQ.xcodeproj')
APP_ID       = 'com.alexkonnaris.hq'
WIDGET_ID    = "#{APP_ID}.widgets"
DEPLOYMENT   = '17.0'

FileUtils.rm_rf(PROJECT_PATH)
project = Xcodeproj::Project.new(PROJECT_PATH, false, 56)

project.build_configurations.each do |c|
  c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = DEPLOYMENT
  c.build_settings['SWIFT_VERSION']              = '5.0'
  c.build_settings['MARKETING_VERSION']          = '1.0'
  c.build_settings['CURRENT_PROJECT_VERSION']    = '1'
end

app     = project.new_target(:application,   'AlexHQ',        :ios, DEPLOYMENT)
widgets = project.new_target(:app_extension, 'AlexHQWidgets', :ios, DEPLOYMENT)

# ---------------------------------------------------------------- groups
app_group    = project.main_group.new_group('AlexHQ',        'AlexHQ')
widget_group = project.main_group.new_group('AlexHQWidgets', 'AlexHQWidgets')
shared_group = project.main_group.new_group('Shared',        'Shared')
web_group    = project.main_group.new_group('Web')

def swift_files(dir)
  Dir.glob(File.join(IOS, dir, '*.swift')).sort.map { |f| File.basename(f) }
end

swift_files('AlexHQ').each        { |f| app.add_file_references([app_group.new_file(f)]) }
swift_files('AlexHQWidgets').each { |f| widgets.add_file_references([widget_group.new_file(f)]) }
# Shared files are compiled into both targets so they always agree.
swift_files('Shared').each do |f|
  ref = shared_group.new_file(f)
  app.add_file_references([ref])
  widgets.add_file_references([ref])
end

# Not compiled: plists and entitlements.
app_group.new_file('Info.plist')
app_group.new_file('AlexHQ.entitlements')
widget_group.new_file('Info.plist')
widget_group.new_file('AlexHQWidgets.entitlements')

# Images and colours.
app.resources_build_phase.add_file_reference(app_group.new_file('Assets.xcassets'))

# ---------------------------------------------------------------- the web app
# Folder reference (a blue folder in Xcode): the whole folder is copied into the app as is.
assets = web_group.new_reference('../assets')
assets.last_known_file_type = 'folder'
assets.explicit_file_type   = nil
app.resources_build_phase.add_file_reference(assets)
{ '../index.html' => 'text.html', '../manifest.webmanifest' => 'text.json' }.each do |path, type|
  ref = web_group.new_reference(path)
  ref.last_known_file_type = type
  app.resources_build_phase.add_file_reference(ref)
end

# ---------------------------------------------------------------- embed the widget extension in the app
embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
embedded = embed.add_file_reference(widgets.product_reference, true)
embedded.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
app.add_dependency(widgets)

%w[WebKit HealthKit ActivityKit WidgetKit LocalAuthentication UserNotifications].each { |f| app.add_system_framework(f) }
%w[WidgetKit SwiftUI ActivityKit].each { |f| widgets.add_system_framework(f) }

# Point the framework links at "whatever SDK this Xcode has" (SDKROOT), not at the
# one version number the generator library happened to know about.
project.frameworks_group.recursive_children.each do |ref|
  next unless ref.is_a?(Xcodeproj::Project::Object::PBXFileReference) && ref.path.to_s.end_with?('.framework')
  ref.path        = "System/Library/Frameworks/#{File.basename(ref.path)}"
  ref.source_tree = 'SDKROOT'
end

# ---------------------------------------------------------------- build settings
def configure(target, settings)
  target.build_configurations.each { |c| c.build_settings.merge!(settings) }
end

configure(app,
  'PRODUCT_BUNDLE_IDENTIFIER'          => APP_ID,
  'PRODUCT_NAME'                       => '$(TARGET_NAME)',
  'INFOPLIST_FILE'                     => 'AlexHQ/Info.plist',
  'GENERATE_INFOPLIST_FILE'            => 'NO',
  'CODE_SIGN_ENTITLEMENTS'             => 'AlexHQ/AlexHQ.entitlements',
  'CODE_SIGN_STYLE'                    => 'Automatic',
  'ASSETCATALOG_COMPILER_APPICON_NAME' => 'AppIcon',
  'TARGETED_DEVICE_FAMILY'             => '1',
  'SWIFT_VERSION'                      => '5.0',
  'IPHONEOS_DEPLOYMENT_TARGET'         => DEPLOYMENT,
  'MARKETING_VERSION'                  => '1.0',
  'CURRENT_PROJECT_VERSION'            => '1',
  'LD_RUNPATH_SEARCH_PATHS'            => ['$(inherited)', '@executable_path/Frameworks'])

configure(widgets,
  'PRODUCT_BUNDLE_IDENTIFIER'          => WIDGET_ID,
  'PRODUCT_NAME'                       => '$(TARGET_NAME)',
  'INFOPLIST_FILE'                     => 'AlexHQWidgets/Info.plist',
  'GENERATE_INFOPLIST_FILE'            => 'NO',
  'CODE_SIGN_ENTITLEMENTS'             => 'AlexHQWidgets/AlexHQWidgets.entitlements',
  'CODE_SIGN_STYLE'                    => 'Automatic',
  'TARGETED_DEVICE_FAMILY'             => '1',
  'SWIFT_VERSION'                      => '5.0',
  'IPHONEOS_DEPLOYMENT_TARGET'         => DEPLOYMENT,
  'MARKETING_VERSION'                  => '1.0',
  'CURRENT_PROJECT_VERSION'            => '1',
  'SKIP_INSTALL'                       => 'YES',
  'APPLICATION_EXTENSION_API_ONLY'     => 'YES',
  'LD_RUNPATH_SEARCH_PATHS'            => ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks'])

# No AccentColor asset in the catalog, so do not point at one.
app.build_configurations.each { |c| c.build_settings.delete('ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME') }

# Tell Xcode which capabilities these targets use, so Signing & Capabilities shows them ticked.
project.root_object.attributes['LastUpgradeCheck'] = '1600'
project.root_object.attributes['TargetAttributes'] = {
  app.uuid => {
    'CreatedOnToolsVersion' => '16.0',
    'SystemCapabilities' => {
      'com.apple.ApplicationGroups.iOS' => { 'enabled' => '1' },
      'com.apple.HealthKit'             => { 'enabled' => '1' },
    },
  },
  widgets.uuid => {
    'CreatedOnToolsVersion' => '16.0',
    'SystemCapabilities' => { 'com.apple.ApplicationGroups.iOS' => { 'enabled' => '1' } },
  },
}

project.save

# ---------------------------------------------------------------- the shared "AlexHQ" scheme (what Run uses)
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.set_launch_target(app)
scheme.save_as(PROJECT_PATH, 'AlexHQ', true)

puts "Wrote #{PROJECT_PATH}"
