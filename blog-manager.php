<?php
namespace Grav\Plugin;

use Grav\Common\Grav;
use Grav\Common\Plugin;
use RocketTheme\Toolbox\Event\Event;

class BlogManagerPlugin extends Plugin
{
    protected $blogPath = null;
    protected $blogFolder = null;
    protected $blogSlug = null;

    public static function getSubscribedEvents()
    {
        return [
            'onPluginsInitialized' => ['onPluginsInitialized', 0],
            'onAdminMenu' => ['onAdminMenu', 0],
            'onAdminTwigTemplatePaths' => ['onAdminTwigTemplatePaths', 0],
            'onAdminControllerInit' => ['onAdminControllerInit', 0],
            'onAdminPage' => ['onAdminPage', 0],
        ];
    }

    public function onPluginsInitialized()
    {
        if (!$this->isAdmin()) {
            return;
        }

        $this->grav['assets']->addCss('plugin://blog-manager/assets/blog-manager.css');
        $this->grav['assets']->addJs('plugin://blog-manager/assets/blog-manager.js', ['group' => 'bottom']);
        $this->blogPath = $this->config->get('plugins.blog-manager.blog_path', '/blog');

        if ($this->config->get('plugins.blog-manager.scan_on_init', true)) {
            $this->detectBlogFolder();
        }
    }

    protected function detectBlogFolder()
    {
        $pagesDir = $this->grav['locator']->findResource('user://pages', true);
        $targetSlug = ltrim($this->blogPath, '/');

        if (!is_dir($pagesDir)) {
            return;
        }

        $numericPattern = '/^(\d+\.)?/';

        $dirs = glob($pagesDir . '/*', GLOB_ONLYDIR);
        foreach ($dirs as $dir) {
            $basename = basename($dir);
            $cleanName = preg_replace($numericPattern, '', $basename);

            if ($cleanName === $targetSlug) {
                $this->blogFolder = $dir;
                $this->blogSlug = $targetSlug;
                return;
            }
        }
    }

    protected function scanPostFiles($blogDir)
    {
        $posts = [];
        $dirs = glob($blogDir . '/*', GLOB_ONLYDIR);

        foreach ($dirs as $dir) {
            $postFiles = glob($dir . '/item*.md');
            if (!empty($postFiles)) {
                $posts[] = [
                    'folder' => basename($dir),
                    'path' => $dir,
                    'files' => array_map('basename', $postFiles)
                ];
            }
        }

        return $posts;
    }

    protected function findItemFile($postDir)
    {
        $defaultItem = $postDir . DS . 'item.md';
        if (file_exists($defaultItem)) {
            return ['file' => $defaultItem, 'lang' => null];
        }

        $langFiles = glob($postDir . '/item.*.md');
        if (!empty($langFiles)) {
            $file = $langFiles[0];
            $basename = basename($file);
            if (preg_match('/^item\.(.+)\.md$/', $basename, $m)) {
                return ['file' => $file, 'lang' => $m[1]];
            }
            return ['file' => $file, 'lang' => null];
        }

        return null;
    }

    protected function extractFirstImage($value)
    {
        if (empty($value)) {
            return '';
        }

        // Handle YAML array (take first element)
        if (is_array($value)) {
            $value = $value[0] ?? '';
        }

        if (!is_string($value) || $value === '') {
            return '';
        }

        // Handle comma-separated list (take first value)
        if (strpos($value, ',') !== false) {
            $parts = explode(',', $value);
            $value = trim($parts[0]);
        }

        return $value;
    }

    protected function detectImageField($header)
    {
        if (!is_array($header)) {
            return '';
        }

        $commonFields = [
            'primaryImage', 'image', 'header_image_file', 'featured_image',
            'thumbnail', 'cover_image', 'header_image', 'post_image',
            'hero_image', 'banner_image', 'featuredImage', 'coverImage'
        ];

        foreach ($commonFields as $field) {
            if (isset($header[$field]) && $header[$field] !== '') {
                $image = $this->extractFirstImage($header[$field]);
                if ($image !== '') {
                    return $image;
                }
            }
        }

        $excludePatterns = ['avatar', 'icon', 'logo', 'favicon', 'profile', 'author', 'social'];
        $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];

        foreach ($header as $key => $value) {
            if (!is_string($value) || $value === '') {
                continue;
            }

            $keyLower = strtolower($key);
            $excluded = false;
            foreach ($excludePatterns as $pattern) {
                if (strpos($keyLower, $pattern) !== false) {
                    $excluded = true;
                    break;
                }
            }
            if ($excluded) {
                continue;
            }

            $image = $this->extractFirstImage($value);
            if ($image === '') {
                continue;
            }

            $ext = strtolower(pathinfo($image, PATHINFO_EXTENSION));
            if (in_array($ext, $imageExtensions)) {
                return $image;
            }
        }

        return '';
    }

    protected function findFirstMediaImage($postDir)
    {
        $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        $excludePatterns = ['avatar', 'icon', 'logo', 'favicon', 'profile', 'author', 'social'];

        foreach ($imageExtensions as $ext) {
            $files = glob($postDir . '/*.' . $ext);
            if (empty($files)) {
                $files = glob($postDir . '/*.' . strtoupper($ext));
            }
            if (empty($files)) {
                continue;
            }

            sort($files);
            foreach ($files as $file) {
                $filename = strtolower(basename($file));
                $excluded = false;
                foreach ($excludePatterns as $pattern) {
                    if (strpos($filename, $pattern) !== false) {
                        $excluded = true;
                        break;
                    }
                }
                if (!$excluded) {
                    return basename($file);
                }
            }
        }

        return '';
    }

    public function onAdminMenu()
    {
        $twig = $this->grav['twig'];
        $twig->plugins_hooked_nav['PLUGIN_BLOG_MANAGER.MENU_TITLE'] = [
            'route' => 'blog-manager',
            'icon' => 'fa-book',
            'authorize' => ['admin.login', 'admin.super'],
            'priority' => 4
        ];
    }

    public function onAdminControllerInit(Event $event)
    {
        $task = $this->grav['uri']->param('task');

        if ($task === 'blogManagerList') {
            $this->handleList();
        } elseif ($task === 'blogManagerDelete') {
            $this->handleDelete();
        } elseif ($task === 'blogManagerToggleField') {
            $this->handleToggleField();
        } elseif ($task === 'blogManagerDuplicate') {
            $this->handleDuplicate();
        } elseif ($task === 'blogManagerNewPost') {
            $this->handleNewPost();
        } elseif ($task === 'blogManagerScan') {
            $this->handleScan();
        } elseif ($task === 'blogManagerExport') {
            $this->handleExport();
        } elseif ($task === 'blogManagerImport') {
            $this->handleImport();
        }
    }

    public function onAdminPage(Event $event)
    {
        $page = $event['page'];
        $route = $page->route();

        if (trim($route, '/') !== 'blog-manager') {
            return;
        }

        $locator = $this->grav['locator'];
        $path = $locator->findResource('plugins://blog-manager/admin/pages/blog-manager.md');
        if ($path) {
            $page->init(new \SplFileInfo($path));
            $event['page'] = $page;
        }
    }

    public function onAdminTwigTemplatePaths(Event $event)
    {
        $paths = $event['paths'];
        $paths[] = __DIR__ . '/templates';
        $event['paths'] = $paths;
    }

    protected function getBlogFolder()
    {
        if ($this->blogFolder) {
            return $this->blogFolder;
        }

        $this->detectBlogFolder();
        return $this->blogFolder;
    }

    protected function getBlogSlug()
    {
        if ($this->blogSlug) {
            return $this->blogSlug;
        }

        $this->detectBlogFolder();
        return $this->blogSlug ?: ltrim($this->blogPath, '/');
    }

    protected function handleScan()
    {
        $this->blogFolder = null;
        $this->blogSlug = null;
        $this->detectBlogFolder();

        $blogDir = $this->getBlogFolder();
        if ($blogDir) {
            $postCount = count($this->scanPostFiles($blogDir));
            $this->jsonResponse([
                'status' => 'success',
                'message' => 'Blog folder found: ' . basename($blogDir) . ' (' . $postCount . ' post(s))'
            ]);
        } else {
            $this->jsonResponse([
                'status' => 'error',
                'message' => 'Blog folder not found for path: ' . $this->blogPath
            ]);
        }
    }

    protected function handleList()
    {
        $blogDir = $this->getBlogFolder();
        if (!$blogDir) {
            $this->jsonResponse([
                'status' => 'error',
                'message' => 'Blog folder not found: ' . $this->blogPath
            ]);
            return;
        }

        $posts = [];
        $adminBase = rtrim($this->grav['uri']->rootUrl(false), '/') . '/' . trim($this->grav['admin']->base, '/');
        $siteUrl = rtrim($this->grav['uri']->rootUrl(true), '/');
        $blogSlug = $this->getBlogSlug();

        $dirs = glob($blogDir . '/*', GLOB_ONLYDIR);

        foreach ($dirs as $postDir) {
            $postFolder = basename($postDir);

            $itemFile = $this->findItemFile($postDir);
            if (!$itemFile) {
                continue;
            }

            $post = [
                'folder' => $postFolder,
                'title' => '',
                'date' => null,
                'visible' => true,
                'published' => true,
                'taxonomy' => [],
                'excerpt' => '',
                'image' => '',
                'image_url' => '',
                'edit_url' => '',
                'lang' => $itemFile['lang']
            ];

            $content = @file_get_contents($itemFile['file']);
            if ($content === false) {
                continue;
            }
            $parts = preg_split('/^---$/m', $content, 3);

            if (count($parts) >= 3) {
                try {
                    $header = \Symfony\Component\Yaml\Yaml::parse(trim($parts[1]));
                } catch (\Exception $e) {
                    $header = null;
                }
                if ($header) {
                    $post['title'] = $header['title'] ?? '';
                    $post['date'] = $header['date'] ?? null;
                    $post['visible'] = $header['visible'] ?? true;
                    $post['published'] = $header['published'] ?? true;
                    $post['taxonomy'] = $header['taxonomy'] ?? [];
                    $post['image'] = $this->detectImageField($header);
                }

                $body = trim($parts[2]);
                $stripped = strip_tags($body);
                $stripped = preg_replace('/[#*_`~\[\]>|!\-]+/', '', $stripped);
                $stripped = preg_replace('/\s+/', ' ', trim($stripped));
                $post['excerpt'] = mb_substr($stripped, 0, 150);
                if (mb_strlen($stripped) > 150) {
                    $post['excerpt'] .= '…';
                }
            }

            if (!$post['image']) {
                $post['image'] = $this->findFirstMediaImage($postDir);
            }

            $postSlug = preg_replace('/^\d+\./', '', $postFolder);
            $post['edit_url'] = $adminBase . '/pages/' . $blogSlug . '/' . $postSlug;

            if ($post['image']) {
                $imagePath = $postDir . DS . $post['image'];
                $cacheVersion = file_exists($imagePath) ? filemtime($imagePath) : time();
                $post['image_url'] = $siteUrl . '/' . $blogSlug . '/' . $postSlug . '/' . $post['image'] . '?v=' . $cacheVersion;
            }

            $posts[] = $post;
        }

        usort($posts, function($a, $b) {
            $dateA = $a['date'] ? strtotime($a['date']) : 0;
            $dateB = $b['date'] ? strtotime($b['date']) : 0;
            return $dateB - $dateA;
        });

        $newPostUrl = $adminBase . '/pages/' . $blogSlug;

        $this->jsonResponse([
            'status' => 'success',
            'posts' => $posts,
            'new_post_url' => $newPostUrl,
            'placeholder_url' => $this->getPlaceholderUrl()
        ]);
    }

    protected function handleDelete()
    {
        $folder = $this->grav['uri']->param('folder');

        if (!$folder) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Post folder not specified']);
            return;
        }

        $blogDir = $this->getBlogFolder();
        if (!$blogDir) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Blog folder not found']);
            return;
        }

        $postDir = $blogDir . DS . $folder;

        if (!is_dir($postDir)) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Post not found']);
            return;
        }

        $this->deleteDirectory($postDir);

        $this->jsonResponse([
            'status' => 'success',
            'message' => 'Post deleted successfully'
        ]);
    }

    protected function handleToggleField()
    {
        $folder = $this->grav['uri']->param('folder');
        $field = $this->grav['uri']->param('field');

        if (!$folder || !in_array($field, ['published', 'visible'])) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Invalid parameters']);
            return;
        }

        $blogDir = $this->getBlogFolder();
        if (!$blogDir) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Blog folder not found']);
            return;
        }

        $postDir = $blogDir . DS . $folder;
        $postFile = $this->findItemFile($postDir);
        if (!$postFile) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Post not found']);
            return;
        }

        $content = @file_get_contents($postFile['file']);
        if ($content === false) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Cannot read post file']);
            return;
        }
        $parts = preg_split('/^---$/m', $content, 3);

        if (count($parts) < 3) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Invalid frontmatter']);
            return;
        }

        try {
            $header = \Symfony\Component\Yaml\Yaml::parse(trim($parts[1]));
        } catch (\Exception $e) {
            $header = null;
        }
        if (!$header) {
            $header = [];
        }

        $current = isset($header[$field]) ? (bool)$header[$field] : true;
        $header[$field] = !$current;

        $newYaml = \Symfony\Component\Yaml\Yaml::dump($header, 10, 2);
        $newContent = '---' . "\n" . $newYaml . '---' . "\n" . $parts[2];
        file_put_contents($postFile, $newContent);

        $this->jsonResponse([
            'status' => 'success',
            'field' => $field,
            'value' => !$current
        ]);
    }

    protected function handleDuplicate()
    {
        $folder = $this->grav['uri']->param('folder');

        if (!$folder) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Post folder not specified']);
            return;
        }

        $blogDir = $this->getBlogFolder();
        if (!$blogDir) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Blog folder not found']);
            return;
        }

        $srcDir = $blogDir . DS . $folder;
        if (!is_dir($srcDir)) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Post not found']);
            return;
        }

        $newFolder = $folder . '-copy';
        $dstDir = $blogDir . DS . $newFolder;
        $counter = 2;
        while (is_dir($dstDir)) {
            $newFolder = $folder . '-copy-' . $counter;
            $dstDir = $blogDir . DS . $newFolder;
            $counter++;
        }

        $this->copyDirectory($srcDir, $dstDir);

        $postFile = $this->findItemFile($dstDir);
        if ($postFile) {
            $content = @file_get_contents($postFile['file']);
            if ($content === false) {
                $content = '';
            }
            $parts = preg_split('/^---$/m', $content, 3);

            if (count($parts) >= 3) {
                try {
                    $header = \Symfony\Component\Yaml\Yaml::parse(trim($parts[1]));
                } catch (\Exception $e) {
                    $header = null;
                }
                if ($header) {
                    if (isset($header['title'])) {
                        $header['title'] = $header['title'] . ' - copy';
                    }
                    $header['published'] = false;

                    $newYaml = \Symfony\Component\Yaml\Yaml::dump($header, 10, 2);
                    $newContent = '---' . "\n" . $newYaml . '---' . "\n" . $parts[2];
                    file_put_contents($postFile, $newContent);
                }
            }
        }

        $this->jsonResponse([
            'status' => 'success',
            'message' => 'Post duplicated successfully',
            'folder' => $newFolder
        ]);
    }

    protected function copyDirectory($src, $dst)
    {
        if (!is_dir($dst)) {
            mkdir($dst, 0755, true);
        }

        $files = array_diff(scandir($src), ['.', '..']);
        foreach ($files as $file) {
            $srcPath = $src . DS . $file;
            $dstPath = $dst . DS . $file;
            if (is_dir($srcPath)) {
                $this->copyDirectory($srcPath, $dstPath);
            } else {
                copy($srcPath, $dstPath);
            }
        }
    }

    protected function handleNewPost()
    {
        $blogDir = $this->getBlogFolder();
        if (!$blogDir) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Blog folder not found']);
            return;
        }

        $maxNum = 0;
        $dirs = glob($blogDir . '/*', GLOB_ONLYDIR);
        foreach ($dirs as $dir) {
            if (preg_match('/^(\d+)\./', basename($dir), $m)) {
                $num = (int)$m[1];
                if ($num > $maxNum) $maxNum = $num;
            }
        }
        $nextNum = str_pad($maxNum + 1, 2, '0', STR_PAD_LEFT);
        $folderName = $nextNum . '.untitled-post';
        $postDir = $blogDir . DS . $folderName;
        $counter = 2;
        while (is_dir($postDir)) {
            $folderName = $nextNum . '.untitled-post-' . $counter;
            $postDir = $blogDir . DS . $folderName;
            $counter++;
        }

        if (!mkdir($postDir, 0755, true) && !is_dir($postDir)) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Could not create post folder']);
            return;
        }

        $frontmatter = [
            'title' => 'Untitled',
            'published' => false,
            'visible' => true,
            'date' => date('Y-m-d'),
            'taxonomy' => [
                'category' => [],
                'tag' => []
            ]
        ];

        $yaml = \Symfony\Component\Yaml\Yaml::dump($frontmatter, 10, 2);
        $content = '---' . "\n" . $yaml . '---' . "\n\n" . 'Write your post here...' . "\n";
        $postFile = $postDir . DS . 'item.md';
        $written = file_put_contents($postFile, $content);

        if ($written === false) {
            rmdir($postDir);
            $this->jsonResponse(['status' => 'error', 'message' => 'Could not write post file']);
            return;
        }

        $rootUrl = rtrim($this->grav['uri']->rootUrl(false), '/');
        $adminBase = $rootUrl . '/' . trim($this->grav['admin']->base, '/');
        $blogSlug = $this->getBlogSlug();
        $postSlug = preg_replace('/^\d+\./', '', $folderName);
        $editUrl = $adminBase . '/pages/' . $blogSlug . '/' . $postSlug;

        $this->jsonResponse([
            'status' => 'success',
            'edit_url' => $editUrl
        ]);
    }

    protected function deleteDirectory($dir)
    {
        if (!is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir), ['.', '..']);

        foreach ($files as $file) {
            $path = $dir . DS . $file;
            if (is_dir($path)) {
                $this->deleteDirectory($path);
            } else {
                unlink($path);
            }
        }

        rmdir($dir);
    }

    protected function getPlaceholderUrl()
    {
        $pluginPath = __DIR__ . DS . 'assets' . DS . 'images';
        $pluginUrl = $this->grav['base_url'] . '/user/plugins/blog-manager/assets/images';

        $customImage = $this->config->get('plugins.blog-manager.placeholder_image');
        if ($customImage) {
            $customPath = $pluginPath . DS . $customImage;
            if (file_exists($customPath)) {
                return $pluginUrl . '/' . $customImage;
            }
        }

        $defaultPath = $pluginPath . DS . 'grav-cms-logo.svg';
        if (file_exists($defaultPath)) {
            return $pluginUrl . '/grav-cms-logo.svg';
        }

        return '';
    }

    protected function handleExport()
    {
        $blogDir = $this->getBlogFolder();
        if (!$blogDir) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Blog folder not found']);
            return;
        }

        // Get requested folders from POST or URL param
        $folders = isset($_POST['folders']) ? $_POST['folders'] : '';
        if ($folders) {
            $folders = array_map('trim', explode(',', $folders));
        } else {
            // Export all
            $dirs = glob($blogDir . '/*', GLOB_ONLYDIR);
            $folders = array_map('basename', $dirs);
        }

        if (empty($folders)) {
            $this->jsonResponse(['status' => 'error', 'message' => 'No posts to export']);
            return;
        }

        if (!class_exists('ZipArchive')) {
            $this->jsonResponse(['status' => 'error', 'message' => 'ZIP extension not available']);
            return;
        }

        $zip = new \ZipArchive();
        $tmpFile = tempnam(sys_get_temp_dir(), 'bm_export_');

        if ($zip->open($tmpFile, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Could not create ZIP file']);
            return;
        }

        foreach ($folders as $folder) {
            $postDir = $blogDir . DS . $folder;
            if (!is_dir($postDir)) {
                continue;
            }
            $zip->addEmptyDir($folder);
            $this->addDirToZip($zip, $postDir, $folder);
        }

        $zip->close();

        $filename = 'blog-export-' . date('Y-m-d') . '.zip';

        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($tmpFile));
        header('Cache-Control: no-cache, must-revalidate');

        readfile($tmpFile);
        unlink($tmpFile);
        exit;
    }

    protected function addDirToZip($zip, $dir, $zipPath)
    {
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $filePath = $dir . DS . $file;
            $zipFilePath = $zipPath . '/' . $file;
            if (is_dir($filePath)) {
                $zip->addEmptyDir($zipFilePath);
                $this->addDirToZip($zip, $filePath, $zipFilePath);
            } else {
                $zip->addFile($filePath, $zipFilePath);
            }
        }
    }

    protected function handleImport()
    {
        $blogDir = $this->getBlogFolder();
        if (!$blogDir) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Blog folder not found']);
            return;
        }

        if (!isset($_FILES['zipfile']) || $_FILES['zipfile']['error'] !== UPLOAD_ERR_OK) {
            $this->jsonResponse(['status' => 'error', 'message' => 'No file uploaded or upload error']);
            return;
        }

        if (!class_exists('ZipArchive')) {
            $this->jsonResponse(['status' => 'error', 'message' => 'ZIP extension not available']);
            return;
        }

        $tmpFile = $_FILES['zipfile']['tmp_name'];
        $zip = new \ZipArchive();

        if ($zip->open($tmpFile) !== true) {
            $this->jsonResponse(['status' => 'error', 'message' => 'Invalid ZIP file']);
            return;
        }

        $tmpDir = tempnam(sys_get_temp_dir(), 'bm_import_');
        unlink($tmpDir);
        mkdir($tmpDir, 0755, true);

        $zip->extractTo($tmpDir);
        $zip->close();

        $imported = 0;
        $skipped = 0;

        $entries = array_diff(scandir($tmpDir), ['.', '..']);
        foreach ($entries as $entry) {
            $srcDir = $tmpDir . DS . $entry;
            if (!is_dir($srcDir)) {
                continue;
            }

            $itemFiles = glob($srcDir . '/item*.md');
            if (empty($itemFiles)) {
                $skipped++;
                continue;
            }

            // Remove numeric prefix for uniqueness check
            $cleanName = preg_replace('/^\d+\./', '', $entry);
            $dstFolder = $entry;
            $dstDir = $blogDir . DS . $dstFolder;
            $counter = 2;
            while (is_dir($dstDir)) {
                $dstFolder = $cleanName . '-' . $counter;
                $dstDir = $blogDir . DS . $dstFolder;
                $counter++;
            }

            $this->copyDirectory($srcDir, $dstDir);
            $imported++;
        }

        $this->deleteDirectory($tmpDir);

        $this->jsonResponse([
            'status' => 'success',
            'imported' => $imported,
            'skipped' => $skipped
        ]);
    }

    protected function jsonResponse(array $data)
    {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
