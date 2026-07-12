<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when an uploaded file's sniffed (magic-byte) content does not match
 * its claimed extension, or is a script/executable regardless of extension.
 * Callers must delete the quarantined file when this is caught (V1-112).
 */
class UploadContentMismatchException extends RuntimeException {}
