<?php
// This is a HONEYPOT.
require 'blacklist.php';
blacklist_ip($_SERVER['REMOTE_ADDR'], "Honeypot Triggered: setup.php");
die("Setup is disabled.");
?>
